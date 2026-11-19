import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Room, RoomEvent, LocalTrackPublication } from 'livekit-client';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Wifi,
  ShieldAlert,
} from 'lucide-react';
import { interviewAccessApi, type InterviewAccessValidation } from '@/lib/api';
import { Spinner, AudioWaveform } from '@/design-system';

type Phase =
  | 'LOADING'
  | 'STARTING'
  | 'AAROHI_SPEAKING'
  | 'CANDIDATE_TURN'
  | 'RECORDING'
  | 'PROCESSING'
  | 'COMPLETE'
  | 'ALREADY_COMPLETED'
  | 'CONSENT_REQUIRED'
  | 'ERROR';

type CameraStatus = 'requesting' | 'active' | 'denied' | 'unavailable' | 'off' | 'ended';
type MicStatus = 'requesting' | 'active' | 'denied' | 'unavailable' | 'muted' | 'ended';

interface QA {
  question: string;
  answer: string;
  questionNumber: number;
}

interface MimeTypeInfo {
  mimeType: string;
  container: string;
}

/**
 * Determine a supported audio MIME type across browsers.
 * Safe fallback hierarchy with Opus codec preference for Groq Whisper STT.
 */
function getSupportedAudioMimeType(): MimeTypeInfo {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', container: 'audio/webm' };
  }

  const candidateTypes: MimeTypeInfo[] = [
    { mimeType: 'audio/webm;codecs=opus', container: 'audio/webm' },
    { mimeType: 'audio/webm', container: 'audio/webm' },
    { mimeType: 'audio/ogg;codecs=opus', container: 'audio/ogg' },
    { mimeType: 'audio/ogg', container: 'audio/ogg' },
    { mimeType: 'audio/mp4', container: 'audio/mp4' },
    { mimeType: 'audio/aac', container: 'audio/aac' },
  ];

  for (const candidate of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    } catch {
      // Continue searching
    }
  }

  return { mimeType: '', container: 'audio/webm' };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export const CandidateVideoInterviewPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Interview state
  const [phase, setPhase] = useState<Phase>('LOADING');
  const [interviewData, setInterviewData] = useState<InterviewAccessValidation | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionId, setQuestionId] = useState('greeting');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [timer, setTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [transcript, setTranscript] = useState<QA[]>([]);
  const [micLevel, setMicLevel] = useState(0);

  // Device & Connection statuses
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('requesting');
  const [micStatus, setMicStatus] = useState<MicStatus>('requesting');
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string>('');
  const [recordingErrorDetail, setRecordingErrorDetail] = useState<string>('');
  const [hasConsent, setHasConsent] = useState<boolean>(false);
  const [livekitStatus, setLivekitStatus] = useState<string>('Initializing');
  const [isLivekitConnected, setIsLivekitConnected] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingMimeTypeRef = useRef<string>('audio/webm');
  const isStartingRecordingRef = useRef<boolean>(false);
  const isSubmittingAnswerRef = useRef<boolean>(false);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);
  const livekitPubsRef = useRef<LocalTrackPublication[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Helper: Play Aarohi voice (WAV base64)
  const playAudio = useCallback(async (base64wav: string) => {
    if (!base64wav) return;
    try {
      const binary = atob(base64wav);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      await audio.play();
      await new Promise<void>((res) => {
        audio.onended = () => res();
        audio.onerror = () => res();
      });
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Audio playback error (non-fatal):', e);
    } finally {
      currentAudioRef.current = null;
    }
  }, []);

  // Real-time microphone level meter
  const startMicMeter = useCallback((ms: MediaStream) => {
    try {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => { });
      }
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(ms);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, Math.round(avg * 2.2)));
        animRef.current = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      // AudioContext fallback
    }
  }, []);

  // Clean, persistent video element ref callback to guarantee attachment
  const setVideoElement = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch((err) => {
        console.warn('Video auto-play handled:', err);
      });
    }
  }, []);

  // Synchronize video srcObject whenever stream or phase changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && mediaStream) {
      if (video.srcObject !== mediaStream) {
        video.srcObject = mediaStream;
      }
      video.play().catch((err) => {
        console.warn('Video play error handled:', err);
      });
    }
  }, [mediaStream, phase]);

  // Request & attach local media stream
  const requestMedia = useCallback(async (): Promise<MediaStream | null> => {
    setCameraStatus('requesting');
    setMicStatus('requesting');
    setCameraErrorDetail('');
    setRecordingErrorDetail('');

    try {
      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      streamRef.current = ms;
      setMediaStream(ms);

      // Verify and monitor video tracks
      const vTracks = ms.getVideoTracks();
      if (vTracks.length > 0 && vTracks[0].readyState === 'live') {
        setCameraStatus('active');
        vTracks[0].onended = () => {
          setCameraStatus('ended');
          setCameraErrorDetail('Camera was disconnected.');
        };
        vTracks[0].onmute = () => setCameraStatus('off');
        vTracks[0].onunmute = () => setCameraStatus('active');
      } else {
        setCameraStatus('unavailable');
        setCameraErrorDetail('Camera track is inactive or unavailable.');
      }

      // Verify and monitor audio tracks
      const aTracks = ms.getAudioTracks();
      if (aTracks.length > 0 && aTracks[0].readyState === 'live') {
        setMicStatus('active');
        aTracks[0].onended = () => {
          setMicStatus('ended');
          setRecordingErrorDetail('Microphone was disconnected.');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
              mediaRecorderRef.current.stop();
            } catch {
              // ignore
            }
            setPhase('CANDIDATE_TURN');
          }
        };
        aTracks[0].onmute = () => setMicStatus('muted');
        aTracks[0].onunmute = () => setMicStatus('active');
        startMicMeter(ms);
      } else {
        setMicStatus('unavailable');
        setRecordingErrorDetail('Microphone track is inactive or unavailable.');
      }

      // Immediate attachment if node already mounted
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.play().catch((err) => console.warn('Video play notice:', err));
      }

      return ms;
    } catch (err: any) {
      console.error('getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setMicStatus('denied');
        setCameraErrorDetail('Camera and microphone permissions were denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('unavailable');
        setMicStatus('unavailable');
        setCameraErrorDetail('No camera or microphone found on this device.');
      } else {
        setCameraStatus('unavailable');
        setMicStatus('unavailable');
        setCameraErrorDetail(err.message || 'Unable to access media devices.');
      }
      return null;
    }
  }, [startMicMeter]);

  // Main lifecycle: Initialize session, devices, LiveKit, Aarohi
  useEffect(() => {
    if (!token) {
      setPhase('ERROR');
      setErrorMsg('Invalid interview token');
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        // 1. Validate Token & Session
        const data = await interviewAccessApi.validate(token);
        if (!isMounted) return;
        setInterviewData(data);

        if (data.alreadyCompleted || data.interview.status === 'COMPLETED') {
          setPhase('ALREADY_COMPLETED');
          return;
        }

        const consent = data.interview.consent;
        const hasRequiredConsent =
          consent.aiDisclosureAccepted &&
          consent.audioRecordingConsent &&
          consent.videoRecordingConsent;
        setHasConsent(hasRequiredConsent);
        if (!hasRequiredConsent) {
          setPhase('CONSENT_REQUIRED');
          return;
        }

        if (data.interview?.durationMinutes) {
          setTotalQuestions(Math.max(3, Math.ceil(data.interview.durationMinutes / 5)));
        }

        // 2. Local Camera & Microphone acquisition
        const ms = await requestMedia();
        if (!isMounted) return;

        // 3. LiveKit Integration (reusing existing camera stream to avoid duplicate hardware stream)
        try {
          const lkData = await interviewAccessApi.getLiveKitToken(token);
          if (!isMounted) return;

          if (lkData.isConfigured && lkData.livekitUrl && lkData.participantToken) {
            setLivekitStatus('Connecting to LiveKit room…');
            const room = new Room({ adaptiveStream: true, dynacast: true });
            livekitRoomRef.current = room;

            room.on(RoomEvent.Connected, () => {
              if (isMounted) {
                setLivekitStatus('LiveKit WebRTC Connected');
                setIsLivekitConnected(true);
              }
            });
            room.on(RoomEvent.Disconnected, () => {
              if (isMounted) {
                setLivekitStatus('LiveKit Disconnected (Media local)');
                setIsLivekitConnected(false);
              }
            });
            room.on(RoomEvent.Reconnecting, () => {
              if (isMounted) setLivekitStatus('LiveKit Reconnecting…');
            });
            room.on(RoomEvent.Reconnected, () => {
              if (isMounted) {
                setLivekitStatus('LiveKit Reconnected');
                setIsLivekitConnected(true);
              }
            });

            await room.connect(lkData.livekitUrl, lkData.participantToken);

            // Publish the existing getUserMedia tracks without opening a duplicate camera
            if (ms) {
              const vTrack = ms.getVideoTracks()[0];
              const aTrack = ms.getAudioTracks()[0];
              if (vTrack && vTrack.readyState === 'live') {
                const pub = await room.localParticipant.publishTrack(vTrack, { name: 'camera' });
                livekitPubsRef.current.push(pub);
              }
              if (aTrack && aTrack.readyState === 'live') {
                const pub = await room.localParticipant.publishTrack(aTrack, { name: 'microphone' });
                livekitPubsRef.current.push(pub);
              }
            }
          } else {
            setLivekitStatus('Media Stream Active (Direct)');
          }
        } catch (lkErr) {
          console.warn('LiveKit connection unavailable, proceeding with direct media:', lkErr);
          setLivekitStatus('Media Stream Active (Direct)');
        }

        if (!isMounted) return;
        if (data.interview.status === 'IN_PROGRESS' || data.interview.status === 'PAUSED') {
          const answeredQuestions = data.interview.sessionHistory.filter(
            (entry) => entry.transcript !== null,
          );
          const nextQuestion = data.interview.sessionHistory.find(
            (entry) =>
              entry.questionNumber === data.interview.currentQuestionIndex + 1 &&
              entry.transcript === null,
          );
          if (nextQuestion) {
            setTranscript(answeredQuestions.map((entry) => ({
              question: entry.questionText,
              answer: entry.transcript ?? '',
              questionNumber: entry.questionNumber,
            })));
            setCurrentQuestion(nextQuestion.questionText);
            setQuestionNumber(nextQuestion.questionNumber);
            setQuestionId(nextQuestion.questionNumber === 1 ? 'greeting' : `q-${nextQuestion.questionNumber}`);
            setPhase('CANDIDATE_TURN');
            return;
          }
        }

        setPhase('STARTING');

        // 4. Start Aarohi First Conversation
        const startRes = await interviewAccessApi.start(token);

        if (!isMounted) return;
        setCurrentQuestion(startRes.firstQuestion);
        setQuestionId('greeting');
        setQuestionNumber(1);
        setPhase('AAROHI_SPEAKING');

        if (startRes.audioBase64) {
          await playAudio(startRes.audioBase64);
        }

        if (isMounted) {
          setPhase('CANDIDATE_TURN');
        }
      } catch (e: any) {
        if (isMounted) {
          setPhase('ERROR');
          setErrorMsg(e.message || String(e));
        }
      }
    })();

    return () => {
      isMounted = false;
      currentAudioRef.current?.pause();

      // Clean up LiveKit publications and disconnect
      livekitPubsRef.current.forEach((pub) => {
        if (pub.track) {
          try {
            livekitRoomRef.current?.localParticipant.unpublishTrack(pub.track as any);
          } catch {
            // ignore
          }
        }
      });
      livekitRoomRef.current?.disconnect();

      // Clean up MediaStream tracks
      streamRef.current?.getTracks().forEach((t) => t.stop());

      // Detach video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Clean up AudioContext & timers
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => { });
      }
    };
  }, [token, playAudio, requestMedia]);

  // Audio Recording Initialization & Start (Problem 2 Resolution)
  const startRecording = useCallback(() => {
    setRecordingErrorDetail('');

    // Check candidate consent
    if (!hasConsent) {
      setRecordingErrorDetail('Recording consent is required before answering.');
      return;
    }

    // Prevent duplicate start operations
    if (isStartingRecordingRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.warn('MediaRecorder is already active.');
      return;
    }

    const stream = streamRef.current;
    if (!stream) {
      setRecordingErrorDetail('Microphone stream is not ready. Please allow mic access and retry.');
      return;
    }

    // Validate that stream has live audio tracks
    const activeAudioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live' && t.enabled);
    if (activeAudioTracks.length === 0) {
      setRecordingErrorDetail('No active microphone track found. Please reconnect your microphone.');
      return;
    }

    try {
      isStartingRecordingRef.current = true;

      // CRITICAL: Extract ONLY audio tracks for the audio-only MediaRecorder
      // Passing a stream containing video tracks to an audio-only MediaRecorder causes NotSupportedError in Chromium!
      const audioOnlyStream = new MediaStream(activeAudioTracks);

      // Probe browser-supported MIME types
      const { mimeType, container } = getSupportedAudioMimeType();
      recordingMimeTypeRef.current = container;

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(audioOnlyStream, options);

      chunksRef.current = [];

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mr.onstart = () => {
        isStartingRecordingRef.current = false;
        setPhase('RECORDING');
        setTimer(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
      };

      mr.onerror = (e: Event) => {
        console.error('MediaRecorder error event:', e);
        isStartingRecordingRef.current = false;
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingErrorDetail('An error occurred during audio recording. Please try answering again.');
        setPhase('CANDIDATE_TURN');
      };

      mr.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };

      // Only start if recorder is inactive
      if (mr.state === 'inactive') {
        mr.start(250);
        mediaRecorderRef.current = mr;
      } else {
        isStartingRecordingRef.current = false;
        console.warn(`MediaRecorder was not inactive: ${mr.state}`);
      }
    } catch (err: any) {
      isStartingRecordingRef.current = false;
      console.error('Failed to start MediaRecorder:', err);
      setRecordingErrorDetail(`Could not start recording: ${err.message || String(err)}`);
      setPhase('CANDIDATE_TURN');
    }
  }, [hasConsent]);

  // Stop recording, collect audio, submit to Groq STT & Gemini Interview Engine
  const stopRecordingAndSubmit = useCallback(async () => {
    if (!token || isSubmittingAnswerRef.current || !mediaRecorderRef.current || !interviewData) return;
    isSubmittingAnswerRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    setPhase('PROCESSING');
    setRecordingErrorDetail('');

    try {
      // Gracefully await MediaRecorder stop
      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError);
          };
          const handleStop = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            reject(new Error('MediaRecorder failed to stop.'));
          };

          recorder.addEventListener('stop', handleStop, { once: true });
          recorder.addEventListener('error', handleError, { once: true });

          try {
            recorder.stop();
          } catch (error) {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError);
            reject(error);
          }
        });
      }

      if (chunksRef.current.length === 0) {
        setRecordingErrorDetail('No audio captured. Please speak into your microphone and try again.');
        setPhase('CANDIDATE_TURN');
        return;
      }

      if (token) {
        interviewAccessApi.recordEvent(token, 'ANSWER_SUBMITTED', { questionNumber, questionId }).catch(() => { });
      }

      const mimeType = recordingMimeTypeRef.current || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      if (blob.size === 0) {
        throw new Error('Recorded audio is empty.');
      }

      const arrayBuf = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuf);

      const res = await interviewAccessApi.recordAnswer(token, {
        questionText: currentQuestion,
        questionNumber,
        audioBase64: base64,
        mimeType,
      });

      const isInterviewComplete = res.interviewComplete || questionNumber >= totalQuestions;
      const nextQuestion = res.nextQuestion ?? 'Could you tell me about yourself?';

      // Append to local transcript
      setTranscript((prev) => [
        ...prev,
        { question: currentQuestion, answer: res.transcript, questionNumber },
      ]);

      if (isInterviewComplete) {
        setPhase('COMPLETE');
        if (res.audioBase64) await playAudio(res.audioBase64);
        setTimeout(() => navigate(`/interview/${token}/done`), 3000);
        return;
      }

      // Transition to next question
      setCurrentQuestion(nextQuestion);
      setQuestionId(questionId === 'greeting' ? 'q-about-yourself' : `q-${questionNumber + 1}`);
      setQuestionNumber((n) => n + 1);
      setPhase('AAROHI_SPEAKING');

      if (res.audioBase64) {
        await playAudio(res.audioBase64);
      }
      setPhase('CANDIDATE_TURN');
    } catch (e: any) {
      console.error('Answer submission error:', e);
      setRecordingErrorDetail(`Audio processing failed: ${e.message || String(e)}`);
      setPhase('CANDIDATE_TURN');
    } finally {
      isSubmittingAnswerRef.current = false;
    }
  }, [interviewData, currentQuestion, questionId, questionNumber, totalQuestions, transcript, token, playAudio, navigate]);

  // Telemetry: Tab Visibility
  useEffect(() => {
    if (!token) return;
    const handleVisibility = () => {
      const event = document.hidden ? 'TAB_HIDDEN' : 'TAB_VISIBLE';
      interviewAccessApi.recordEvent(token, event).catch(() => { });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [token]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Safe retry handler for media devices
  const handleRetryDevices = async () => {
    await requestMedia();
  };

  // Full-screen Loading State
  if (phase === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Spinner size="lg" className="mb-4 text-blue-500" />
        <h2 className="text-xl font-bold mb-1">Aarohi Interview Room</h2>
        <p className="text-blue-300 text-sm">Validating session credentials and setting up devices…</p>
      </div>
    );
  }

  // Full-screen Fatal Error State
  if (phase === 'ERROR') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Interview Connection Issue</h2>
          <p className="text-gray-300 text-sm mb-6">{errorMsg}</p>
          <button
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl transition-colors text-white"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'CONSENT_REQUIRED') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Consent Required</h2>
          <p className="text-gray-300 text-sm mb-6">
            Explicit AI, microphone, and camera consent is required before accessing interview media.
          </p>
          <button
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl transition-colors text-white"
            onClick={() => navigate(`/interview/${token}`)}
          >
            Review Consent
          </button>
        </div>
      </div>
    );
  }

  // Completed State
  if (phase === 'COMPLETE') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center text-white p-6">
        <div className="text-center p-8 max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Interview Completed!</h1>
          <p className="text-blue-200 text-sm mb-4">
            Thank you for completing your voice interview with Aarohi. Your responses are being evaluated.
          </p>
          <p className="text-xs text-gray-400">Redirecting to interview summary…</p>
        </div>
      </div>
    );
  }

  if (phase === 'ALREADY_COMPLETED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center text-white p-6">
        <div className="text-center p-8 max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Interview Already Completed</h1>
          <p className="text-blue-200 text-sm">
            This invitation belongs to a completed interview attempt and cannot be reused.
            Please contact your recruiter if you need another attempt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none">
      {/* Top Header: System status, branding and indicators */}
      <header className="h-16 px-4 md:px-6 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>Aarohi Voice Interview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Live Session
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {interviewData?.job.title} · {interviewData?.candidate.firstName}
            </div>
          </div>
        </div>

        {/* Live Device & Connection Status Bar */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Connection status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
            <Wifi className={`w-3.5 h-3.5 ${isLivekitConnected ? 'text-green-400' : 'text-blue-400'}`} />
            <span className="text-gray-300">{livekitStatus}</span>
          </div>

          {/* Camera status badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
            {cameraStatus === 'active' ? (
              <>
                <Video className="w-3.5 h-3.5 text-green-400" />
                <span className="hidden md:inline text-gray-300">Camera On</span>
              </>
            ) : (
              <>
                <VideoOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-medium">Camera Off</span>
              </>
            )}
          </div>

          {/* Microphone status badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
            {micStatus === 'active' ? (
              <>
                <Mic className="w-3.5 h-3.5 text-green-400" />
                <span className="hidden md:inline text-gray-300">Mic Ready</span>
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-medium">Mic Off</span>
              </>
            )}
          </div>

          {/* Step Counter */}
          <div className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-gray-300">
            {questionNumber}/{totalQuestions}
          </div>

          {/* Live Recording Indicator */}
          {phase === 'RECORDING' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono animate-pulse font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span>REC {formatTime(timer)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Full-Screen Interview Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6 items-stretch justify-center min-h-0 overflow-y-auto">
        {/* =========================================================================
            PRIMARY VISUAL ELEMENT: Candidate Hero Video Area (65–80% of workspace)
            ========================================================================= */}
        <div className="flex-1 flex flex-col min-h-[380px] lg:min-h-0 relative">
          <div className="relative w-full h-full min-h-[360px] md:min-h-[460px] lg:min-h-[560px] rounded-2xl overflow-hidden bg-slate-900/90 border border-white/10 shadow-2xl flex items-center justify-center">
            {/* Live Video Feed */}
            {cameraStatus === 'active' ? (
              <video
                ref={setVideoElement}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            ) : (
              /* Camera Unavailable / Error State (No black box) */
              <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 text-slate-400 flex items-center justify-center mb-4 shadow-lg">
                  {cameraStatus === 'denied' ? (
                    <ShieldAlert className="w-8 h-8 text-amber-400" />
                  ) : (
                    <VideoOff className="w-8 h-8 text-red-400" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {cameraStatus === 'denied'
                    ? 'Camera Permission Denied'
                    : cameraStatus === 'ended'
                      ? 'Camera Feed Disconnected'
                      : cameraStatus === 'requesting'
                        ? 'Accessing Camera Feed…'
                        : 'Camera Feed Unavailable'}
                </h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  {cameraErrorDetail ||
                    'Your camera feed is required for this video interview. Please ensure your camera is connected and allowed in your browser settings.'}
                </p>
                <button
                  type="button"
                  onClick={handleRetryDevices}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Camera Connection</span>
                </button>
              </div>
            )}

            {/* Overlaid Badges on Candidate Video */}
            {/* 1. Top-Left: Live indicator badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white shadow-lg pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full ${cameraStatus === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`}
              />
              <span className="font-medium">You (Candidate)</span>
            </div>

            {/* 2. Top-Right: Microphone Audio Level Bar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs shadow-lg pointer-events-none">
              <Mic className={`w-3.5 h-3.5 ${micLevel > 10 ? 'text-green-400' : 'text-slate-400'}`} />
              <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 transition-all duration-75 rounded-full"
                  style={{ width: `${Math.max(8, micLevel)}%` }}
                />
              </div>
            </div>

            {/* 3. Bottom Banner: Active Phase Prompt Overlay */}
            <div className="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-xs md:text-sm text-center shadow-lg max-w-lg">
                {phase === 'STARTING' && (
                  <span className="text-blue-300">Aarohi is tuning audio and starting your session…</span>
                )}
                {phase === 'AAROHI_SPEAKING' && (
                  <span className="text-blue-300">Aarohi is speaking… Please listen to the question.</span>
                )}
                {phase === 'CANDIDATE_TURN' && (
                  <span className="text-amber-300 font-medium">
                    It's your turn. Click "Start Answering" below when ready to speak.
                  </span>
                )}
                {phase === 'RECORDING' && (
                  <span className="text-red-400 font-semibold animate-pulse">
                    ● Recording your response… Speak clearly into your microphone.
                  </span>
                )}
                {phase === 'PROCESSING' && (
                  <span className="text-blue-300">Evaluating your response with Groq & Aarohi…</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SIDEBAR: Aarohi Voice Assistant, Current Question & Controls (20–35%)
            ========================================================================= */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-4 justify-between shrink-0">
          {/* Aarohi Compact Voice-Only Assistant Card */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>Aarohi</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      AI Voice
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Technical Recruiter</div>
                </div>
              </div>

              {/* Aarohi Current Speaking State Pill */}
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                <span
                  className={`w-2 h-2 rounded-full ${phase === 'AAROHI_SPEAKING'
                    ? 'bg-blue-400 animate-ping'
                    : phase === 'RECORDING'
                      ? 'bg-green-400'
                      : phase === 'PROCESSING'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                />
                <span className="text-slate-300">
                  {phase === 'AAROHI_SPEAKING'
                    ? 'Speaking'
                    : phase === 'RECORDING'
                      ? 'Listening'
                      : phase === 'PROCESSING'
                        ? 'Thinking'
                        : 'Awaiting turn'}
                </span>
              </div>
            </div>

            {/* Aurora Intelligence Waveform Visualizer for Aarohi */}
            <div className="relative bg-black/40 border border-white/5 rounded-xl overflow-hidden p-2">
              <AudioWaveform
                state={
                  phase === 'AAROHI_SPEAKING'
                    ? 'speaking'
                    : phase === 'RECORDING'
                      ? 'listening'
                      : phase === 'PROCESSING'
                        ? 'thinking'
                        : 'idle'
                }
                className="h-16 w-full"
                barCount={24}
              />
            </div>
          </div>

          {/* Current Question & Progress Card */}
          <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[180px]">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold uppercase tracking-wider text-blue-400">
                  Question {questionNumber} of {totalQuestions}
                </span>
                <span className="font-mono">{Math.round((questionNumber / totalQuestions) * 100)}% Complete</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Question Text */}
              <p className="text-base md:text-lg font-medium leading-relaxed text-white">
                {currentQuestion ? `"${currentQuestion}"` : 'Preparing your next question…'}
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>Position: {interviewData?.job.title}</span>
              <span>Lang: {interviewData?.interview.language.toUpperCase()}</span>
            </div>
          </div>

          {/* Candidate Action Turn Controls */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            {/* Recording error alert if triggered */}
            {recordingErrorDetail && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1">
                  <span>{recordingErrorDetail}</span>
                  <button
                    type="button"
                    onClick={handleRetryDevices}
                    className="block mt-1 font-semibold underline text-red-200 hover:text-white"
                  >
                    Retry Microphone Access
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons based on Phase */}
            {phase === 'CANDIDATE_TURN' && (
              <button
                type="button"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-semibold text-white shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm md:text-base"
                onClick={startRecording}
              >
                <Mic className="w-5 h-5" />
                <span>Start Answering</span>
              </button>
            )}

            {phase === 'RECORDING' && (
              <button
                type="button"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-semibold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm md:text-base"
                onClick={stopRecordingAndSubmit}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Submit Answer</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-black/30 rounded-md">
                  {formatTime(timer)}
                </span>
              </button>
            )}

            {phase === 'PROCESSING' && (
              <div className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-white/10 text-blue-300 flex items-center justify-center gap-3 text-sm">
                <Spinner size="sm" />
                <span>Transcribing & Aarohi evaluating…</span>
              </div>
            )}

            {phase === 'AAROHI_SPEAKING' && (
              <div className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>Listening to Aarohi…</span>
              </div>
            )}

            {phase === 'STARTING' && (
              <div className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center gap-2 text-sm">
                <Spinner size="sm" />
                <span>Preparing interview…</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Horizontal mirror transformation for selfie camera */}
      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
};

export default CandidateVideoInterviewPage;

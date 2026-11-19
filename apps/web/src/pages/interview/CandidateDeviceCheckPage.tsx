import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@/design-system';
import { interviewAccessApi } from '@/lib/api';

export const CandidateDeviceCheckPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [consentVerified, setConsentVerified] = useState(false);
  const animRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    if (!token) {
      setError('Invalid interview link.');
      return () => {
        active = false;
      };
    }

    interviewAccessApi.validate(token)
      .then((data) => {
        if (!active) return;
        if (data.alreadyCompleted || data.interview.status === 'COMPLETED') {
          navigate(`/interview/${token}`, { replace: true });
          return;
        }
        const consent = data.interview.consent;
        if (
          !consent.aiDisclosureAccepted ||
          !consent.audioRecordingConsent ||
          !consent.videoRecordingConsent
        ) {
          navigate(`/interview/${token}`, { replace: true });
          return;
        }
        if (active) setConsentVerified(true);
      })
      .catch(() => {
        if (active) navigate(`/interview/${token}`, { replace: true });
      });

    return () => {
      active = false;
    };
  }, [navigate, token]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const requestPermissions = async () => {
    if (!consentVerified) return;
    setChecking(true);
    setError(null);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setStream(ms);
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
      }

      // Microphone level animation
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(ms);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const measure = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, avg * 2));
        animRef.current = requestAnimationFrame(measure);
      };
      measure();
    } catch (e) {
      setError('Could not access camera or microphone. Please allow permissions and try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleStart = () => {
    if (stream) navigate(`/interview/${token}/live`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
          <h1 className="text-lg font-bold">Device Setup</h1>
          <p className="text-blue-200 text-sm">Check your camera and microphone before starting</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Camera Preview */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Camera Preview</p>
            <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {stream ? (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-500 text-sm flex flex-col items-center">
                  <span className="text-3xl mb-2">📷</span>
                  <span>Camera not started</span>
                </div>
              )}
            </div>
          </div>

          {/* Microphone Level */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Microphone Level</p>
            <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-100"
                style={{ width: `${micLevel}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {stream ? (micLevel > 5 ? '✅ Microphone working' : 'Speak to test mic…') : 'Start device check to test'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 <strong>Tips:</strong> Find a quiet space with good lighting. Speak clearly and at a normal pace.
              The interview is turn-based — Aarohi will ask a question, then you respond.
            </p>
          </div>

          {!stream ? (
            <button
              className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={requestPermissions}
              disabled={checking || !consentVerified}
            >
              {checking ? <span className="inline-flex items-center gap-2"><Spinner size="sm" /> Checking…</span> : 'Check Camera & Microphone'}
            </button>
          ) : (
            <button
              className="w-full py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700"
              onClick={handleStart}
            >
              ✅ Ready — Start Interview →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateDeviceCheckPage;

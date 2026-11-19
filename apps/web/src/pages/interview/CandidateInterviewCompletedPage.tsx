import React from 'react';

export const CandidateInterviewCompletedPage: React.FC = () => {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Completed!</h1>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Thank you for interviewing with Aarohi. Your responses have been recorded and transcribed.
          Our recruiting team will review your interview along with your resume and contact you
          regarding next steps.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left text-xs text-gray-500 space-y-2 mb-6">
          <p className="font-semibold text-gray-700">What happens next?</p>
          <p>• The recruiter reviews the comprehensive interview report and your submitted answers.</p>
          <p>• All final decisions are made by human hiring managers.</p>
          <p>• You will receive an update via email regarding your application status.</p>
        </div>

        <button
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          onClick={() => window.close()}
        >
          Close Window
        </button>
      </div>
    </div>
  );
};

export default CandidateInterviewCompletedPage;

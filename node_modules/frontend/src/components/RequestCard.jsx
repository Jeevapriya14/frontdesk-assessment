import React from 'react';

export default function RequestCard({ request, onResolve, onArchive }) {
  const status = (request.status || '').toUpperCase();
  const answeredAt = request.answered_at ? new Date(request.answered_at).toLocaleString() : null;

  return (
    <div className={`bg-white p-4 rounded shadow-sm border ${status !== 'PENDING' ? 'opacity-80' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="text-sm text-gray-500">From: {request.caller_id || request.caller || 'unknown'}</div>
          <div className="font-medium text-gray-800 mt-1">{request.question_text || request.question || request.question_text}</div>
          <div className="text-xs text-gray-500 mt-2">Status: {status}</div>
          {answeredAt && <div className="text-xs text-gray-500 mt-1">Answered: {answeredAt}</div>}
        </div>

        <div className="flex flex-col gap-2 ml-4">
          {status === 'PENDING' && (
            <button
              onClick={() => onResolve && onResolve(request)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Answer
            </button>
          )}

          {status !== 'PENDING' && (
            <button
              onClick={() => onArchive && onArchive(request)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

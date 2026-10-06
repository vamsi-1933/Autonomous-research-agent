import React, { useState, useRef } from 'react';

const ResearchDashboard = () => {
  // Existing State
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [finalReport, setFinalReport] = useState('');
  const [error, setError] = useState('');
  
  // New Q&A State
  const [chatHistory, setChatHistory] = useState([]);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  
  const abortControllerRef = useRef(null);

  // Original Research Stream Handler
  const startResearch = async () => {
    if (!query.trim()) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setError('');
    setFinalReport('');
    setChatHistory([]); // Clear previous chat
    setCurrentStep('Initializing Agent...');

    try {
      const response = await fetch('api/research/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream' 
        },
        body: JSON.stringify({ 
          query, 
          is_follow_up: false, 
          session_id: 'dashboard_session_001' 
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          
          try {
            const eventData = JSON.parse(line.trim().substring(5));
            
            if (eventData.error) {
              setError(eventData.error);
              setIsProcessing(false);
            } else if (eventData.final_answer) {
              setFinalReport(eventData.final_answer);
              setCurrentStep('✅ Research Complete');
              setIsProcessing(false);
            } else if (eventData.step) {
              setCurrentStep(eventData.step);
            }
          } catch (e) {
            console.warn('Parse error:', e);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setIsProcessing(false);
      }
    }
  };

  // NEW: Follow-up Q&A Handler
  const handleFollowUp = async () => {
    if (!followUpQuery.trim() || !finalReport) return;

    setIsAnswering(true);
    const userMsg = { role: 'user', content: followUpQuery };
    setChatHistory(prev => [...prev, userMsg]);
    setFollowUpQuery('');

    try {
      const response = await fetch('http://localhost:8081/api/research/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream' 
        },
        body: JSON.stringify({ 
          query: followUpQuery, 
          is_follow_up: true, // Triggers QA agent in LangGraph
          session_id: 'dashboard_session_001',
          final_synthesis: finalReport // Grounds answer in report
        })
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          
          try {
            const eventData = JSON.parse(line.trim().substring(5));
            if (eventData.final_answer) {
              assistantResponse = eventData.final_answer;
            }
          } catch (e) { console.warn(e); }
        }
      }

      if (assistantResponse) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
      }
    } catch (err) {
      setError(`Q&A Failed: ${err.message}`);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-amber-200 min-h-screen">
      {/* Header & Input Section (Unchanged) */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Autonomous Research Agent</h1>
        <p className="text-gray-500 mt-1">Real-time Agentic AI Research & Synthesis Dashboard</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter complex research query..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          disabled={isProcessing}
          onKeyDown={(e) => e.key === 'Enter' && startResearch()}
        />
        <button
          onClick={startResearch}
          disabled={isProcessing || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Start Research'}
        </button>
      </div>

      {/* Status Monitor (Unchanged) */}
      {(isProcessing || currentStep) && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <div className="flex items-center gap-3">
            {isProcessing && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
            <span className="font-semibold text-blue-900">{currentStep}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Final Report & Q&A Section */}
      {finalReport && (
        <div className="space-y-6">
          {/* Synthesized Report Card */}
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Synthesized Research Report</h2>
            </div>
            <div className="p-6 prose prose-blue max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                {finalReport}
              </pre>
            </div>
          </div>

          {/* NEW: Q&A Chat Interface */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Ask Follow-up Questions</h3>
            
            {/* Chat History */}
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
              {chatHistory.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-100 ml-8 text-blue-900' 
                      : 'bg-gray-100 mr-8 text-gray-800'
                  }`}
                >
                  <p className="font-bold text-xs mb-1 opacity-70">
                    {msg.role === 'user' ? 'You' : 'Research Agent'}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isAnswering && (
                <div className="text-gray-500 italic text-sm animate-pulse">
                  Agent is analyzing the report...
                </div>
              )}
            </div>

            {/* Q&A Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={followUpQuery}
                onChange={(e) => setFollowUpQuery(e.target.value)}
                placeholder="Ask something specific about the report above..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                disabled={isAnswering}
              />
              <button
                onClick={handleFollowUp}
                disabled={isAnswering || !followUpQuery.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isAnswering ? 'Thinking...' : 'Ask Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchDashboard;
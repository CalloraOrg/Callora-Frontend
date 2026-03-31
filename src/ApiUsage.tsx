import { useEffect, useRef, useState } from 'react';

type ApiEndpoint = {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
};

type CallRecord = {
  id: string;
  timestamp: Date;
  endpoint: string;
  status: 'success' | 'error';
  responseTime: number;
  cost: number;
  request?: any;
  response?: any;
};

type UsageStats = {
  callsToday: number;
  callsWeek: number;
  totalSpent: number;
  avgResponseTime: number;
  successRate: number;
};

const MOCK_ENDPOINTS: ApiEndpoint[] = [
  {
    id: '1',
    name: 'Get User Profile',
    method: 'GET',
    path: '/api/v1/user/profile',
    description: 'Retrieve user profile information'
  },
  {
    id: '2',
    name: 'Create Transaction',
    method: 'POST',
    path: '/api/v1/transactions',
    description: 'Create a new transaction'
  },
  {
    id: '3',
    name: 'Update Balance',
    method: 'PUT',
    path: '/api/v1/user/balance',
    description: 'Update user balance'
  }
];

const MOCK_CALL_HISTORY: CallRecord[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    endpoint: '/api/v1/user/profile',
    status: 'success',
    responseTime: 120,
    cost: 0.001
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    endpoint: '/api/v1/transactions',
    status: 'success',
    responseTime: 250,
    cost: 0.003
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    endpoint: '/api/v1/user/balance',
    status: 'error',
    responseTime: 5000,
    cost: 0.001
  }
];

const CODE_EXAMPLES = {
  javascript: `// JavaScript/Node.js example
const apiKey = 'your-api-key-here';

const response = await fetch('https://api.callora.com/v1/user/profile', {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);`,
  python: `# Python example
import requests

api_key = 'your-api-key-here'

response = requests.get(
    'https://api.callora.com/v1/user/profile',
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(data)`,
  curl: `# cURL example
curl -X GET "https://api.callora.com/v1/user/profile" \\
  -H "Authorization: Bearer your-api-key-here" \\
  -H "Content-Type: application/json"`
};

function formatUsdc(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatTime(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function ApiUsage() {
  const [apiKey, setApiKey] = useState('ck_live_4e85ff1ed6a4ff73893a0bf73f2bb');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(MOCK_ENDPOINTS[0]);
  const [requestParams, setRequestParams] = useState('{}');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [callCost, setCallCost] = useState<number | null>(null);
  const [callHistory, setCallHistory] = useState<CallRecord[]>(MOCK_CALL_HISTORY);
  const [selectedLanguage, setSelectedLanguage] = useState<'javascript' | 'python' | 'curl'>('javascript');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  
  const [usageStats, setUsageStats] = useState<UsageStats>({
    callsToday: 47,
    callsWeek: 312,
    totalSpent: 2.847,
    avgResponseTime: 180,
    successRate: 94.2
  });

  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy API key');
    }
  };

  const handleRegenerateApiKey = () => {
    const newKey = 'ck_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setApiKey(newKey);
  };

  const handleMakeTestCall = async () => {
    setIsLoading(true);
    setApiResponse(null);
    setResponseTime(null);
    setCallCost(null);
    
    const startTime = Date.now();
    
    // Simulate API call
    setTimeout(() => {
      const endTime = Date.now();
      const time = endTime - startTime;
      const cost = Math.random() * 0.005 + 0.001;
      
      setResponseTime(time);
      setCallCost(cost);
      
      // Mock response
      const mockResponse = {
        success: true,
        data: {
          id: 'user_123',
          name: 'John Doe',
          email: 'john@example.com',
          balance: 1250.50,
          created_at: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
      
      setApiResponse(mockResponse);
      
      // Add to call history
      const newCall: CallRecord = {
        id: Date.now().toString(),
        timestamp: new Date(),
        endpoint: selectedEndpoint.path,
        status: 'success',
        responseTime: time,
        cost: cost,
        request: requestParams,
        response: mockResponse
      };
      
      setCallHistory(prev => [newCall, ...prev]);
      
      // Update stats
      setUsageStats(prev => ({
        ...prev,
        callsToday: prev.callsToday + 1,
        callsWeek: prev.callsWeek + 1,
        totalSpent: prev.totalSpent + cost,
        avgResponseTime: (prev.avgResponseTime * prev.callsToday + time) / (prev.callsToday + 1)
      }));
      
      setIsLoading(false);
    }, 1000 + Math.random() * 2000);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code');
    }
  };

  const handleExportHistory = (format: 'csv' | 'json') => {
    const data = callHistory.map(call => ({
      timestamp: call.timestamp.toISOString(),
      endpoint: call.endpoint,
      status: call.status,
      responseTime: call.responseTime,
      cost: call.cost
    }));
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'call-history.json';
      a.click();
    } else {
      const csv = [
        'Timestamp,Endpoint,Status,Response Time,Cost',
        ...data.map(call => 
          `${call.timestamp},${call.endpoint},${call.status},${call.responseTime},${call.cost}`
        )
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'call-history.csv';
      a.click();
    }
  };

  return (
    <div className="api-usage-page">
      {/* Header Section */}
      <div className="api-header">
        <div className="api-header-info">
          <div className="api-logo">
            <div className="logo-placeholder">API</div>
          </div>
          <div>
            <h1>User Profile API</h1>
            <p className="api-description">Manage user profiles and authentication</p>
          </div>
        </div>
        <div className="api-header-actions">
          <button className="secondary-button" onClick={() => window.history.back()}>
            ← Back to API Details
          </button>
          <div className="status-indicator active">
            <span className="status-dot"></span>
            API is Active
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="surface api-key-section">
        <h2>API Key</h2>
        <div className="api-key-card">
          <div className="api-key-display">
            <div className="key-input-group">
              <input
                type={isApiKeyVisible ? 'text' : 'password'}
                value={apiKey}
                readOnly
                className="api-key-input"
              />
              <button
                className="ghost-button"
                onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
              >
                {isApiKeyVisible ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="key-actions">
              <button className="secondary-button" onClick={handleCopyApiKey}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="danger-button" onClick={handleRegenerateApiKey}>
                Regenerate
              </button>
            </div>
          </div>
          <p className="usage-instruction">
            Include this key in your requests as a Bearer token in the Authorization header.
          </p>
        </div>
      </div>

      {/* Test API Call Section */}
      <div className="surface test-call-section">
        <h2>Test API Call</h2>
        <div className="test-call-form">
          <div className="form-row">
            <label>Endpoint</label>
            <select
              value={selectedEndpoint.id}
              onChange={(e) => {
                const endpoint = MOCK_ENDPOINTS.find(ep => ep.id === e.target.value);
                if (endpoint) setSelectedEndpoint(endpoint);
              }}
              className="endpoint-select"
            >
              {MOCK_ENDPOINTS.map(endpoint => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.method} {endpoint.path} - {endpoint.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-row">
            <label>Parameters (JSON)</label>
            <textarea
              value={requestParams}
              onChange={(e) => setRequestParams(e.target.value)}
              placeholder='{"key": "value"}'
              className="params-textarea"
              rows={4}
            />
          </div>
          
          <button
            className="primary-button"
            onClick={handleMakeTestCall}
            disabled={isLoading}
          >
            {isLoading ? 'Making Call...' : 'Make Test Call'}
          </button>
        </div>
        
        {(apiResponse || isLoading) && (
          <div className="response-display">
            <h3>Response</h3>
            {isLoading ? (
              <div className="loading-placeholder">Loading...</div>
            ) : (
              <div className="response-content">
                <div className="response-meta">
                  <span className="response-time">Response time: {formatTime(responseTime || 0)}</span>
                  <span className="response-cost">Cost: {formatUsdc(callCost || 0)} USDC</span>
                </div>
                <pre className="response-json">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      <div className="surface usage-stats-section">
        <h2>Usage Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Calls Today</span>
            <strong className="stat-value">{usageStats.callsToday}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Calls This Week</span>
            <strong className="stat-value">{usageStats.callsWeek}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Spent</span>
            <strong className="stat-value">{formatUsdc(usageStats.totalSpent)} USDC</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Response Time</span>
            <strong className="stat-value">{formatTime(usageStats.avgResponseTime)}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Success Rate</span>
            <strong className="stat-value">{usageStats.successRate}%</strong>
          </div>
        </div>
        
        <div className="mini-chart">
          <h4>Calls Over Time</h4>
          <div className="chart-placeholder">
            {/* Simple bar chart visualization */}
            <div className="chart-bars">
              {[65, 59, 80, 81, 56, 55, 47].map((height, i) => (
                <div key={i} className="chart-bar" style={{height: `${height}%`}}></div>
              ))}
            </div>
            <div className="chart-labels">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
      </div>

      {/* Call History */}
      <div className="surface call-history-section">
        <div className="section-header">
          <h2>Call History</h2>
          <div className="history-actions">
            <select className="filter-select">
              <option>All Status</option>
              <option>Success</option>
              <option>Error</option>
            </select>
            <button className="secondary-button" onClick={() => handleExportHistory('csv')}>
              Export CSV
            </button>
            <button className="secondary-button" onClick={() => handleExportHistory('json')}>
              Export JSON
            </button>
          </div>
        </div>
        
        <div className="call-history-table">
          <div className="table-header">
            <span>Timestamp</span>
            <span>Endpoint</span>
            <span>Status</span>
            <span>Response Time</span>
            <span>Cost</span>
            <span>Actions</span>
          </div>
          
          {callHistory.map(call => (
            <div key={call.id} className="table-row">
              <span>{formatTimestamp(call.timestamp)}</span>
              <span className="endpoint-cell">{call.endpoint}</span>
              <span className={`status-cell ${call.status}`}>
                {call.status === 'success' ? '✓' : '✗'} {call.status}
              </span>
              <span>{formatTime(call.responseTime)}</span>
              <span>{formatUsdc(call.cost)} USDC</span>
              <span>
                <button
                  className="ghost-button"
                  onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                >
                  {expandedCall === call.id ? 'Hide' : 'View'}
                </button>
              </span>
              
              {expandedCall === call.id && (
                <div className="expanded-details">
                  <div className="detail-section">
                    <h4>Request</h4>
                    <pre>{JSON.stringify(call.request || {}, null, 2)}</pre>
                  </div>
                  <div className="detail-section">
                    <h4>Response</h4>
                    <pre>{JSON.stringify(call.response || {}, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Integration Guide */}
      <div className="surface integration-guide-section">
        <h2>Integration Guide</h2>
        
        <div className="language-tabs">
          {(['javascript', 'python', 'curl'] as const).map(lang => (
            <button
              key={lang}
              className={`tab-button ${selectedLanguage === lang ? 'active' : ''}`}
              onClick={() => setSelectedLanguage(lang)}
            >
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>
        
        <div className="code-example">
          <div className="code-header">
            <h3>{selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Example</h3>
            <button
              className="secondary-button"
              onClick={() => handleCopyCode(CODE_EXAMPLES[selectedLanguage])}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <pre className="code-block">
            <code>{CODE_EXAMPLES[selectedLanguage]}</code>
          </pre>
        </div>
        
        <div className="documentation-link">
          <a href="#" className="primary-button">View Full Documentation →</a>
        </div>
      </div>
    </div>
  );
}

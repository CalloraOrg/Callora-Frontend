import { useState } from 'react';

function App() {
  const [tab, setTab] = useState<'dashboard' | 'apis' | 'billing'>('dashboard');

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Callora</h1>
        <p className="tagline">Programmable API Access</p>
        <nav className="nav">
          <button
            className={tab === 'dashboard' ? 'active' : ''}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={tab === 'apis' ? 'active' : ''}
            onClick={() => setTab('apis')}
          >
            APIs
          </button>
          <button
            className={tab === 'billing' ? 'active' : ''}
            onClick={() => setTab('billing')}
          >
            Billing
          </button>
        </nav>
      </header>
      <main className="main">
        {tab === 'dashboard' && (
          <section>
            <h2>Dashboard</h2>
            <p>API usage, vault balance, and recent calls will appear here.</p>
          </section>
        )}
        {tab === 'apis' && (
          <section>
            <h2>APIs</h2>
            <p>Publish and manage your APIs and pricing.</p>
          </section>
        )}
        {tab === 'billing' && (
          <section>
            <h2>Billing</h2>
            <p>Deposit USDC, view settlements, and revenue.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

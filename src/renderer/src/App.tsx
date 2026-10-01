import { Routes, Route } from 'react-router-dom';
import ServerList from './pages/ServerList';
import ServerDetail from './pages/ServerDetail';
import CreateServer from './pages/CreateServer';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Raspberry MC Server Manager</h1>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ServerList />} />
          <Route path="/create" element={<CreateServer />} />
          <Route path="/server/:id" element={<ServerDetail />} />
        </Routes>
      </main>
    </div>
  );
}

import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Brand, Spinner } from '../components/Chrome.jsx';

const DoctorContext = createContext(null);
export const useDoctor = () => useContext(DoctorContext);

/**
 * Client-side guard for doctor pages. This only controls what is rendered -
 * every doctor API call is independently authorised on the server.
 */
export function RequireDoctor() {
  const [doctor, setDoctor] = useState(undefined);
  const location = useLocation();

  useEffect(() => {
    api.get('/api/doctor/me').then(setDoctor).catch(() => setDoctor(null));
  }, []);

  if (doctor === undefined) return <div className="main"><Spinner title="Checking sign-in…" /></div>;
  if (doctor === null) return <Navigate to="/doctor/login" replace state={{ from: location.pathname }} />;
  return (
    <DoctorContext.Provider value={doctor}>
      <DoctorShell />
    </DoctorContext.Provider>
  );
}

function DoctorShell() {
  const doctor = useDoctor();
  const navigate = useNavigate();
  const logout = async () => {
    await api.post('/api/doctor/logout').catch(() => {});
    navigate('/', { replace: true });
  };
  return (
    <div className="shell">
      <header className="topbar">
        <div className="row">
          <Brand to="/doctor" subtitle="Doctor dashboard" />
          <nav className="nav">
            <NavLink to="/doctor" end>Patients</NavLink>
            <NavLink to="/doctor/metrics">Metrics</NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <span className="hide-sm">{doctor.name}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="main"><Outlet /></main>
    </div>
  );
}

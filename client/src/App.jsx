import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './LandingPage.jsx';
import { PatientLayout } from './patient/PatientLayout.jsx';
import { IntakePage } from './patient/IntakePage.jsx';
import { ReviewPage } from './patient/ReviewPage.jsx';
import { CompletePage } from './patient/CompletePage.jsx';
import { UrgentPage } from './patient/UrgentPage.jsx';
import { LoginPage } from './doctor/LoginPage.jsx';
import { RequireDoctor } from './doctor/DoctorAuth.jsx';
import { DashboardPage } from './doctor/DashboardPage.jsx';
import { PatientDetailPage } from './doctor/PatientDetailPage.jsx';
import { MetricsPage } from './doctor/MetricsPage.jsx';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

export function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/patient" element={<PatientLayout />}>
        <Route index element={<IntakePage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="complete" element={<CompletePage />} />
        <Route path="urgent" element={<UrgentPage />} />
      </Route>

      <Route path="/doctor/login" element={<LoginPage />} />
      <Route path="/doctor" element={<RequireDoctor />}>
        <Route index element={<DashboardPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="metrics" element={<MetricsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

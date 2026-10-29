import { Route, Routes, Navigate } from "react-router-dom";
import Layout from "./layouts/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import Assistant from "./pages/Assistant.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import Prescriptions from "./pages/Prescriptions.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/patients" replace />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="vigilance" element={<Dashboard />} />
        <Route path="medicaments" element={<Placeholder titre="Médicaments" membre="A" />} />
        <Route path="risques" element={<Placeholder titre="Risques" membre="B" />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="assistant" element={<Assistant />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
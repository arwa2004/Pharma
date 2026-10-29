import { Route, Routes, Navigate } from "react-router-dom";
import Layout from "./layouts/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import Pathologies from "./pages/Pathologies.jsx";
import Medicaments from "./pages/Medicaments.jsx";
import MedicamentDetail from "./pages/MedicamentDetail.jsx";
import Assistant from "./pages/Assistant.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import Prescriptions from "./pages/Prescriptions.jsx";
import Risques from "./pages/Risques.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/medicaments" replace />} />
        <Route path="medicaments" element={<Medicaments />} />
        <Route path="medicaments/:id" element={<MedicamentDetail />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="pathologies" element={<Pathologies />} />
        <Route path="vigilance" element={<Dashboard />} />
        <Route path="risques" element={<Risques />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="assistant" element={<Assistant />} />
      </Route>
      <Route path="*" element={<Navigate to="/medicaments" replace />} />
    </Routes>
  );
}
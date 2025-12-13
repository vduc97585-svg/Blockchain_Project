import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";

function PrivateRoute({ role, allowedRole, children }) {
  if (!role) return <Navigate to="/" />;
  if (role !== allowedRole) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const [role, setRole] = useState(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login setRole={setRole} />} />

        <Route
          path="/admin"
          element={
            <PrivateRoute role={role} allowedRole="admin">
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/hospital"
          element={
            <PrivateRoute role={role} allowedRole="hospital">
              <HospitalDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/doctor"
          element={
            <PrivateRoute role={role} allowedRole="doctor">
              <DoctorDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/patient"
          element={
            <PrivateRoute role={role} allowedRole="patient">
              <PatientDashboard />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

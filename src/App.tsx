import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { AdminAuthProvider } from "./context/AdminAuth";
import AdminPage from "./pages/AdminPage";
import CreatePollPage from "./pages/CreatePollPage";
import EditPollPage from "./pages/EditPollPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import PollPage from "./pages/PollPage";

export default function App() {
  return (
    <ToastProvider>
      <AdminAuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="create" element={<CreatePollPage />} />
            <Route path="p/:id" element={<PollPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/polls/:id/edit" element={<EditPollPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AdminAuthProvider>
    </ToastProvider>
  );
}

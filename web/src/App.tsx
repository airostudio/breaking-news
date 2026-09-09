import { BrowserRouter, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import RequireRole from "./components/RequireRole";
import { AuthProvider } from "./lib/auth";
import Dashboard from "./pages/Dashboard";
import Front from "./pages/Front";
import ListingDetail from "./pages/ListingDetail";
import Login from "./pages/Login";
import Marketplace from "./pages/Marketplace";
import Newsroom from "./pages/Newsroom";
import NewsroomDetail from "./pages/NewsroomDetail";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import Purchases from "./pages/Purchases";
import Register from "./pages/Register";
import Story from "./pages/Story";
import Upload from "./pages/Upload";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Front />} />
          <Route path="/story/:id" element={<Story />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/upload"
            element={
              <RequireRole roles={["contributor"]}>
                <Upload />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole roles={["contributor"]}>
                <Dashboard />
              </RequireRole>
            }
          />

          <Route
            path="/newsroom"
            element={
              <RequireRole roles={["editor"]}>
                <Newsroom />
              </RequireRole>
            }
          />
          <Route
            path="/newsroom/:id"
            element={
              <RequireRole roles={["editor"]}>
                <NewsroomDetail />
              </RequireRole>
            }
          />

          <Route
            path="/marketplace"
            element={
              <RequireRole roles={["outlet"]}>
                <Marketplace />
              </RequireRole>
            }
          />
          <Route
            path="/marketplace/:id"
            element={
              <RequireRole roles={["outlet"]}>
                <ListingDetail />
              </RequireRole>
            }
          />
          <Route
            path="/purchases"
            element={
              <RequireRole roles={["outlet"]}>
                <Purchases />
              </RequireRole>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer className="site-footer">
          <div className="container">
            BNO — Breaking News Outlet. Contributors keep 70% of every license sale.
          </div>
        </footer>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

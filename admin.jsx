import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Users, ClipboardList, Activity, TrendingUp, RefreshCw,
  Search, LogOut, BarChart3, CheckCircle2, XCircle
} from "lucide-react";
import "./admin.css";

const API = "/api/cbt-dashboard";

function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function App() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}?pin=${encodeURIComponent(pin)}`,
        { headers: { Accept: "application/json" } }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load dashboard.");
      }

      setData(result);
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(false);
      setData(null);
      setError(err.message || "Dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setPin("");
    setAuthenticated(false);
    setData(null);
    setError("");
  }

  const attempts = useMemo(() => {
    const list = data?.recentAttempts || [];
    const q = query.trim().toLowerCase();

    if (!q) return list;

    return list.filter((item) =>
      [
        item.studentId,
        item.studentName,
        item.examTitle,
        item.examId,
        item.result,
        item.status
      ].join(" ").toLowerCase().includes(q)
    );
  }, [data, query]);

  if (!authenticated) {
    return (
      <div className="admin-page">
        <Header />
        <main className="login-area">
          <section className="login-card">
            <div className="admin-symbol">AF</div>
            <div className="eyebrow">AIBINU FLEXIPREP EDUCONSULT</div>
            <h1>CBT Admin Dashboard</h1>
            <p>Secure access to examination activity and performance.</p>

            <label>Administrator PIN</label>
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              placeholder="Enter PIN"
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin) loadDashboard();
              }}
            />

            {error && <div className="error-box">{error}</div>}

            <button
              className="primary-btn"
              disabled={loading || !pin}
              onClick={loadDashboard}
            >
              {loading ? "Checking..." : "Open Dashboard"}
            </button>

            <small className="security-note">
              The PIN is checked server-side. Never place the real PIN in frontend code.
            </small>
          </section>
        </main>
      </div>
    );
  }

  const counts = data?.counts || {};

  return (
    <div className="admin-page">
      <Header />

      <main className="dashboard">
        <div className="dashboard-title">
          <div>
            <div className="eyebrow">AIBINU FLEXIPREP EDUCONSULT</div>
            <h1>CBT Admin Dashboard</h1>
            <p>Monitor students, examinations, attempts and results.</p>
          </div>

          <div className="toolbar">
            <span className="live-badge">● Connected</span>
            <button onClick={loadDashboard}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={logout}>
              <LogOut size={15} /> Exit
            </button>
          </div>
        </div>

        <section className="stats">
          <Stat icon={<Users />} label="Students" value={counts.students ?? 0} />
          <Stat icon={<ClipboardList />} label="Examinations" value={counts.exams ?? 0} />
          <Stat icon={<Activity />} label="Attempts" value={counts.attempts ?? 0} />
          <Stat icon={<TrendingUp />} label="Pass Rate" value={`${counts.passRate ?? 0}%`} />
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Recent CBT Attempts</h2>
                <p>Latest examination activity from Airtable.</p>
              </div>
              <BarChart3 />
            </div>

            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student, exam or result..."
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Exam</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.length ? attempts.map((item) => (
                    <tr key={item.recordId}>
                      <td>
                        <strong>{item.studentId || "—"}</strong>
                        <small>{item.studentName || "Student"}</small>
                      </td>
                      <td>{item.examTitle || item.examId || "—"}</td>
                      <td>
                        {item.percentage == null ? "—" : `${item.percentage}%`}
                      </td>
                      <td>
                        <span className={`result-pill ${
                          item.result === "PASS"
                            ? "pass"
                            : item.result === "FAIL"
                            ? "fail"
                            : ""
                        }`}>
                          {item.result === "PASS" && <CheckCircle2 size={13} />}
                          {item.result === "FAIL" && <XCircle size={13} />}
                          {item.result || item.status || "—"}
                        </span>
                      </td>
                      <td>{fmt(item.submitTime || item.startTime)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="empty">
                        No attempt records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Examinations</h2>
                <p>Exams currently available in Airtable.</p>
              </div>
            </div>

            <div className="exam-list">
              {(data?.exams || []).map((exam) => (
                <div className="exam-card" key={exam.id}>
                  <div className="subject-box">
                    {(exam.subject || "CBT").slice(0, 4)}
                  </div>

                  <div className="exam-info">
                    <strong>{exam.title || "Untitled examination"}</strong>
                    <small>
                      {exam.questionCount || 0} questions •{" "}
                      {exam.duration || 0} min • Pass{" "}
                      {exam.passMark || 0}%
                    </small>
                  </div>

                  <span className="result-pill">
                    {exam.status || "—"}
                  </span>
                </div>
              ))}

              {!data?.exams?.length && (
                <div className="empty">No examinations found.</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="admin-header">
      <div className="brand">
        <div className="logo">AF</div>
        <div>
          <strong>AIBINU FLEXIPREP</strong>
          <small>EDUCONSULT • CBT ADMIN</small>
        </div>
      </div>
    </header>
  );
}

createRoot(document.getElementById("admin-root")).render(<App />);

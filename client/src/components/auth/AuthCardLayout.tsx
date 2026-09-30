import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

interface AuthCardLayoutProps {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
}

export const AuthCardLayout: React.FC<AuthCardLayoutProps> = ({
  children,
  backTo = "/",
  backLabel = "Back to sign in",
}) => {
  const navigate = useNavigate();

  return (
    <div className="auth-root">
      <div className="auth-blob auth-blob-1" aria-hidden="true" />
      <div className="auth-blob auth-blob-2" aria-hidden="true" />
      <main className="auth-card">
        <button
          type="button"
          className="auth-back"
          onClick={() => navigate(backTo)}
          aria-label={backLabel}
        >
          <ArrowLeftIcon size={16} aria-hidden="true" /> {backLabel}
        </button>
        {children}
      </main>
    </div>
  );
};

export default AuthCardLayout;

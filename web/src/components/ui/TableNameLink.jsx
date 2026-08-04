import { Link } from "react-router-dom";

export default function TableNameLink({ to, ariaLabel, children }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className="block rounded-sm text-sm font-extrabold leading-tight text-base-content hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
    >
      {children}
    </Link>
  );
}

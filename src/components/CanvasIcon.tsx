export default function CanvasIcon() {
  return (
    <div className="w-5 h-5 relative">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="canvas-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="1" />
            <stop offset="50%" stopColor="#0066ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#0000ff" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Canvas outline - like the empty canvas icon */}
        <path
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4l2 2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z"
          stroke="url(#canvas-gradient)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner lines for canvas effect */}
        <path
          d="M9 9h6M9 13h6M9 17h4"
          stroke="url(#canvas-gradient)"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}


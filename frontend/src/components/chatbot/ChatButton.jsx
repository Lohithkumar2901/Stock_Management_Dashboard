export default function ChatButton({ onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 group"
    >
      {/* Pulse ring */}
      {!isOpen && (
        <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-25" />
      )}

      <div
        className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? "bg-gradient-to-br from-red-400 to-rose-500 rotate-0 shadow-rose-200"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-300 hover:shadow-xl hover:scale-110 active:scale-95"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-6 h-6 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
        >
          {isOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          )}
        </svg>
      </div>
    </button>
  );
}

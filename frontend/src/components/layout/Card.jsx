export default function Card({ children }) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4">
      {children}
    </div>
  );
}
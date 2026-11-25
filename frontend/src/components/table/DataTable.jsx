export default function DataTable({ data }) {
  if (!data) return null;

  const cols = Object.keys(data[0] || {});

  return (
    <div className="max-h-60 overflow-auto border rounded mt-3">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            {cols.map(c => <th key={c} className="p-2">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c} className="p-2">{row[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
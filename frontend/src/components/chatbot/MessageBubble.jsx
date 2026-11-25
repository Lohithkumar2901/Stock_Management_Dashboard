function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47" />
      </svg>
    </div>
  );
}

export default function MessageBubble({ role, text, table, month }) {
  const isUser = role === "user";

  // Bot with table
  if (!isUser && table && table.length > 0) {
    const cols = Object.keys(table[0]);
    return (
      <div className="flex items-start gap-2.5 mb-3">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-gray-200/80 overflow-hidden bg-white shadow-sm">
            {/* Table header */}
            <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 px-4 py-2 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125" />
                  </svg>
                  <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                    Results
                  </span>
                </div>
                {month && (
                  <span className="text-[10px] font-medium bg-indigo-100/80 text-indigo-600 px-2 py-0.5 rounded-md">
                    {month}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                {table.length} {table.length === 1 ? "row" : "rows"}
              </span>
            </div>

            {/* Table body */}
            <div className="max-h-[340px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap w-8">
                      #
                    </th>
                    {cols.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-100 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 hover:bg-indigo-50/40 transition-colors ${
                        i === 0 ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-300 font-medium whitespace-nowrap">
                        {i + 1}
                      </td>
                      {cols.map((col) => (
                        <td
                          key={col}
                          className={`px-3 py-2 whitespace-nowrap ${
                            i === 0 ? "text-gray-900 font-medium" : "text-gray-700"
                          }`}
                        >
                          {row[col] != null && row[col] !== "" ? row[col] : (
                            <span className="text-gray-300">N/A</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User bubble
  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%]">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm shadow-indigo-200/50">
            {text && <p className="whitespace-pre-wrap">{text}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Bot text-only
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <BotAvatar />
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-gray-100 text-gray-700 rounded-2xl rounded-tl-sm shadow-sm px-4 py-2.5 text-sm leading-relaxed max-w-[90%]">
          {text && <p className="whitespace-pre-wrap">{text}</p>}
          {month && !table?.length && (
            <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
              </svg>
              {month}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

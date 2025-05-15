<table className="w-full text-sm border mt-6">
  <thead className="bg-gray-100">
    <tr>
      <th className="border px-2 py-1">姓名</th>
      <th className="border px-2 py-1">聯絡方式</th>
      <th className="border px-2 py-1">推薦碼</th>
      <th className="border px-2 py-1">上傳時間</th>
      <th className="border px-2 py-1">截圖</th>
    </tr>
  </thead>
  <tbody>
    {data.map((entry) => (
      <tr key={entry.id}>
        <td className="border px-2 py-1">{entry.name}</td>
        <td className="border px-2 py-1">{entry.phone}</td>
        <td className="border px-2 py-1">{entry.referralCode || '-'}</td>
        <td className="border px-2 py-1">{new Date(entry.createdAt).toLocaleString()}</td>
        <td className="border px-2 py-1">
          <a href={entry.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-500 underline">查看</a>
        </td>
      </tr>
    ))}
  </tbody>
</table>

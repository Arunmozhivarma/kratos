import { useState } from 'react';
import { faqs } from '../data/mockData';

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Help</h1>
      <div className="card-surface p-5"><h3 className="mb-4 font-semibold">FAQ</h3><div className="space-y-2">{faqs.map((faq, i) => <div key={faq.q} className="rounded-xl border border-emerald-100"><button onClick={() => setOpenIndex(openIndex === i ? -1 : i)} className="w-full px-4 py-3 text-left font-medium">{faq.q}</button>{openIndex === i && <p className="px-4 pb-4 text-sm text-gray-600">{faq.a}</p>}</div>)}</div></div>
      <div className="grid gap-4 md:grid-cols-2"><div className="card-surface p-5"><h3 className="font-semibold">Contact</h3><p className="mt-2 text-sm text-gray-600">support@kratos-energy.local</p><p className="text-sm text-gray-600">+62 000 111 222</p></div><div className="card-surface p-5"><h3 className="font-semibold">Quick Guide</h3><ol className="mt-2 list-decimal pl-5 text-sm text-gray-600"><li>Login with authorized credentials.</li><li>Monitor dashboard live cards.</li><li>Use Device Control for manual override.</li><li>Review alerts weekly.</li></ol></div></div>
    </div>
  );
}

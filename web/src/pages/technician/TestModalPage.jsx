const TestModalPage = () => (
  <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
    <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 px-8 h-16 flex items-center flex-shrink-0">
      <div>
        <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">Test Modal</h1>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">This page is ready to be designed.</p>
      </div>
    </header>
    <main className="flex-1 p-8 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-2xl">📋</div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-200">Test Modal</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
          Start fresh — this page has no content yet. Build your design here.
        </p>
      </div>
    </main>
  </div>
);
export default TestModalPage;

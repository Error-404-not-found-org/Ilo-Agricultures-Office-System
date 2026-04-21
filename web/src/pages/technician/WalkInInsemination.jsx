import { useState, useEffect } from "react";

export default function WalkInInsemination() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">Preparing Registration Form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Walk-in Registration</h1>
      <p className="text-gray-500">
        Register a new walk-in farmer, their animal, and an immediate insemination record.
      </p>

      <div className="card bg-base-100 shadow-xl border border-gray-100 placeholder-glow">
        <div className="card-body">
          <h2 className="card-title text-lg text-gray-700 border-b pb-2 mb-4">Farmer Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text">First Name</span></label>
              <input type="text" placeholder="John" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Last Name</span></label>
              <input type="text" placeholder="Doe" className="input input-bordered" />
            </div>
            <div className="form-control col-span-2">
              <label className="label"><span className="label-text">Email Address (Optional)</span></label>
              <input type="email" placeholder="john.doe@example.com" className="input input-bordered" />
            </div>
          </div>

          <h2 className="card-title text-lg text-gray-700 border-b pb-2 mb-4 mt-8">Animal Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Ear Tag</span></label>
              <input type="text" placeholder="TAG-1234" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Species</span></label>
              <select className="select select-bordered">
                <option value="cow">Cow / Cattle</option>
                <option value="carabao">Carabao</option>
                <option value="goat">Goat</option>
                <option value="pig">Pig / Swine</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Breed</span></label>
              <input type="text" placeholder="Brahman" className="input input-bordered" />
            </div>
          </div>

          <h2 className="card-title text-lg text-gray-700 border-b pb-2 mb-4 mt-8">Insemination Record</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Sire Breed</span></label>
              <input type="text" placeholder="Angus" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Sire Code</span></label>
              <input type="text" placeholder="S-5678" className="input input-bordered" />
            </div>
          </div>

          <div className="card-actions justify-end mt-8">
            <button className="btn btn-primary w-full md:w-auto">Submit Walk-in Transaction</button>
          </div>
        </div>
      </div>
    </div>
  );
}

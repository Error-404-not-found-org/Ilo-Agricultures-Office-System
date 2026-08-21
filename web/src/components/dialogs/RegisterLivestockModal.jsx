import { useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, Camera, Loader2, PawPrint, Sparkles, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  BREED_OPTIONS_BY_SPECIES,
  CATTLE_BREEDS,
  CATTLE_COLORS,
  CATTLE_SPECIES,
} from "../../constants/breeds";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";

const initialFormData = {
  earTag: "",
  brand: "",
  species: "Beef Cattle",
  breed: "",
  color: "",
  gender: "Female",
  dob: "",
  farmerName: "",
};

const getFarmerInitials = (name) => {
  if (!name || typeof name !== "string") return "ANM";
  const cleaned = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ANM";
  if (parts.length === 1) {
    const word = parts[0];
    return word.length >= 2 ? word.slice(0, 2).toUpperCase() : word.toUpperCase();
  }
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return (first + last).toUpperCase();
};

const buildAutoEarTag = (farmerName, existingCount = 0) => {
  if (!farmerName || typeof farmerName !== "string" || !farmerName.trim()) {
    return `ANM-${String((existingCount || 0) + 1).padStart(3, "0")}`;
  }
  const initials = getFarmerInitials(farmerName);
  const nextNum = String((existingCount || 0) + 1).padStart(3, "0");
  return `${initials}-${nextNum}`;
};

const RegisterLivestockModal = ({
  isOpen,
  onClose,
  onSuccess,
  livestock = null,
  preSelectedFarmer = null,
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const ownerListId = `livestock-owners-${useId().replaceAll(":", "")}`;
  const [searchFarmer, setSearchFarmer] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState(initialFormData);

  const {
    data: farmers = [],
    error: farmersError,
    isError: isFarmersError,
    isLoading: isLoadingFarmers,
    refetch: refetchFarmers,
  } = useQuery({
    queryKey: ["farmers", "list"],
    queryFn: async () => {
      const response = await axiosInstance.get("/user?role=farmer");
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    },
    enabled: isOpen,
  });

  const filteredFarmers = useMemo(() => {
    const query = searchFarmer.trim().toLowerCase();
    return farmers.filter((farmer) => (farmer.name || "").toLowerCase().includes(query));
  }, [farmers, searchFarmer]);

  const { data: selectedFarmerAnimals = [] } = useQuery({
    queryKey: ["farmer-animals-count", formData.farmerName],
    queryFn: async () => {
      if (!formData.farmerName) return [];
      const response = await axiosInstance.get(`/animals/farmer/${formData.farmerName}`);
      return Array.isArray(response.data)
        ? response.data
        : response.data?.data || response.data?.animals || [];
    },
    enabled: Boolean(formData.farmerName && isOpen && !livestock),
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (livestock) {
        const payload = {
          earTag: data.earTag,
          brand: data.brand,
          species: data.species,
          breed: data.breed,
          color: data.color,
          gender: data.gender,
          birthDate: data.dob || null,
          imageUrl: data.imageUrl,
        };
        const response = await axiosInstance.put(
          `/animals/wizard/${livestock._id || livestock.id}`,
          payload,
        );
        return response.data;
      }

      const response = await axiosInstance.post("/technician/walk-in-livestock", data);
      return response.data;
    },
    onSuccess: async (result) => {
      toast.success(
        livestock
          ? "Livestock profile updated successfully!"
          : "Livestock profile registered successfully!",
      );
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["technician"] }),
        queryClient.invalidateQueries({ queryKey: ["animals"] }),
        queryClient.invalidateQueries({ queryKey: ["farmer-animals"] }),
      ]);
      onSuccess?.(result?.animal || result?.data || result);
      onClose();
    },
    onError: (error) => {
      toast.error(
        `${livestock ? "Failed to update livestock: " : "Failed to register livestock: "}${
          error.response?.data?.message || error.message
        }`,
      );
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    if (livestock) {
      const formattedDob = livestock.birthDate
        ? new Date(livestock.birthDate).toISOString().split("T")[0]
        : "";
      Promise.resolve().then(() => {
        setFormData({
          earTag: livestock.earTag || "",
          brand: livestock.brand || "",
          species: livestock.species || "Beef Cattle",
          breed: livestock.breed || "",
          color: livestock.color || "",
          gender: livestock.gender || "Female",
          dob: formattedDob,
          farmerName: livestock.farmerId?._id || livestock.farmerId || "",
        });
        setSearchFarmer(livestock.farmerId?.name || "Unknown Farmer");
        setImagePreview(livestock.imageUrl || null);
        setIsDropdownOpen(false);
      });
      return;
    }

    Promise.resolve().then(() => {
      const initialFarmerId = preSelectedFarmer?._id || preSelectedFarmer?.id || "";
      const farmerName = preSelectedFarmer?.name || "";
      const initialCount = preSelectedFarmer?.animalsCount || 0;
      const autoTag = buildAutoEarTag(farmerName, initialCount);

      setFormData({
        ...initialFormData,
        farmerName: initialFarmerId,
        earTag: autoTag,
      });
      setSearchFarmer(farmerName);
      setImagePreview(null);
      setIsDropdownOpen(false);
    });
  }, [isOpen, livestock, preSelectedFarmer]);

  useEffect(() => {
    if (!isOpen || livestock) return;

    const matchedFarmer = farmers.find(
      (f) => String(f._id || f.id) === String(formData.farmerName),
    ) || preSelectedFarmer;
    const currentName = searchFarmer || matchedFarmer?.name || "";
    const knownCount =
      matchedFarmer?.animalsCount ??
      (Array.isArray(selectedFarmerAnimals) ? selectedFarmerAnimals.length : 0);

    const generatedTag = buildAutoEarTag(currentName, knownCount);

    setFormData((current) => {
      if (!current.earTag || /^([A-Z]{2,3}-\d{3})$/.test(current.earTag)) {
        return { ...current, earTag: generatedTag };
      }
      return current;
    });
  }, [formData.farmerName, searchFarmer, selectedFarmerAnimals, farmers, preSelectedFarmer, isOpen, livestock]);

  useEffect(() => {
    const validBreeds = BREED_OPTIONS_BY_SPECIES[formData.species] || [];
    if (formData.breed && !validBreeds.includes(formData.breed)) {
      Promise.resolve().then(() => {
        setFormData((current) => ({ ...current, breed: "" }));
      });
    }
  }, [formData.breed, formData.species]);

  if (!isOpen) return null;

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return toast.error("Please select a valid image file.");
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      return toast.error("Animal photos must be 5 MB or smaller.");
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (!imagePreview) return toast.error("Animal photo is required to register an animal.");
    if (!formData.farmerName) return toast.error("Please select a livestock owner.");
    if (!formData.breed) return toast.error("Breed is required.");
    if (!formData.species) return toast.error("Species is required.");

    mutation.mutate({ ...formData, imageUrl: imagePreview });
  };

  const closeSafely = () => {
    if (!mutation.isPending) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeSafely}
      closeOnEscape
      title={livestock ? "Edit Animal" : "Register Animal"}
      subtitle={
        livestock
          ? "Update animal identity and livestock details."
          : "Link a new animal to an existing farmer."
      }
      icon={<PawPrint size={22} className="text-primary" />}
      size="4xl"
      bodyClassName="custom-scrollbar"
      actions={
        <>
          <button type="button" onClick={closeSafely} disabled={mutation.isPending} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="register-livestock-form"
            disabled={mutation.isPending}
            className="btn btn-primary px-6"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                Saving animal…
              </>
            ) : (
              <>
                <BadgeCheck size={16} />
                Save Animal
              </>
            )}
          </button>
        </>
      }
    >
      <form id="register-livestock-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <fieldset className="fieldset self-start">
          <legend className="fieldset-legend text-sm font-bold flex items-center justify-between">
            <span>Animal photo <span className="text-error">*</span></span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-error bg-error/10 px-2 py-0.5 rounded-full">Required</span>
          </legend>
          <label
            htmlFor="animal-photo"
            className={`group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
              !imagePreview ? "border-dashed border-error/40 bg-base-200/50 hover:bg-base-200" : "border-primary/40 bg-base-100"
            }`}
          >
            {imagePreview ? (
              <div className="relative h-full w-full">
                <img src={imagePreview} alt="Selected animal" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-2">
                  <Camera size={20} />
                  <span className="text-xs font-bold">Change photo</span>
                </div>
              </div>
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error transition-transform group-hover:scale-110">
                  <Camera size={20} />
                </span>
                <div>
                  <span className="block text-xs font-bold text-base-content">Upload or capture photo</span>
                  <span className="block text-[10px] font-bold text-error mt-0.5">Required for registration</span>
                </div>
                <span className="text-[10px] font-semibold text-base-content/50">PNG, JPG, or WEBP (Max 5MB)</span>
              </span>
            )}
            <input id="animal-photo" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
          </label>
          {imagePreview && (
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="btn btn-ghost btn-xs text-error w-full mt-2"
            >
              <X size={13} className="mr-1" /> Remove photo
            </button>
          )}
        </fieldset>

        <div className="space-y-6">
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-sm font-bold">Ownership details</legend>
            <div className="relative">
              <Input
                id="livestock-owner"
                label="Search owner or farmer"
                required
                value={searchFarmer}
                disabled={Boolean(livestock)}
                autoComplete="off"
                role="combobox"
                aria-expanded={isDropdownOpen && !livestock}
                aria-controls={ownerListId}
                aria-autocomplete="list"
                placeholder="Type farmer name…"
                onFocus={() => !livestock && setIsDropdownOpen(true)}
                onChange={(event) => {
                  setSearchFarmer(event.target.value);
                  setFormData((current) => ({ ...current, farmerName: "" }));
                  setIsDropdownOpen(true);
                }}
              />
              {isDropdownOpen && !livestock && (
                <div
                  id={ownerListId}
                  role="listbox"
                  aria-label="Matching farmers"
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl"
                >
                  {isLoadingFarmers ? (
                    <div className="space-y-2 p-3" role="status" aria-label="Loading farmers">
                      <div className="skeleton h-10 w-full" />
                      <div className="skeleton h-10 w-full" />
                    </div>
                  ) : isFarmersError ? (
                    <div className="alert alert-error m-2 w-auto text-sm" role="alert">
                      <span>{farmersError?.response?.data?.message || "Unable to load farmers."}</span>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => refetchFarmers()}>Try again</button>
                    </div>
                  ) : filteredFarmers.length ? (
                    filteredFarmers.map((farmer) => (
                      <button
                        key={farmer._id}
                        type="button"
                        role="option"
                        aria-selected={formData.farmerName === farmer._id}
                        onClick={() => {
                          const farmerCount = farmer.animalsCount ?? 0;
                          const autoTag = buildAutoEarTag(farmer.name, farmerCount);
                          setFormData((current) => ({
                            ...current,
                            farmerName: farmer._id,
                            earTag: autoTag,
                          }));
                          setSearchFarmer(farmer.name);
                          setIsDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {(farmer.name || "Farmer").substring(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-base-content">{farmer.name}</span>
                          <span className="block text-xs font-medium text-base-content/60">Farmer</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-8 text-center text-sm font-medium text-base-content/60">No farmers found</p>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-sm font-bold">Animal details</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative">
                <Input
                  id="livestock-ear-tag"
                  label="Ear tag number"
                  required
                  value={formData.earTag}
                  maxLength={15}
                  onChange={updateField("earTag")}
                  placeholder="e.g. JG-001"
                  hint={searchFarmer ? `Auto-generated based on ${searchFarmer}'s initials` : "Auto-generates when farmer is selected"}
                />
                {searchFarmer && !livestock && (
                  <button
                    type="button"
                    onClick={() => {
                      const matchedFarmer = farmers.find(
                        (f) => String(f._id || f.id) === String(formData.farmerName),
                      ) || preSelectedFarmer;
                      const knownCount =
                        matchedFarmer?.animalsCount ??
                        (Array.isArray(selectedFarmerAnimals) ? selectedFarmerAnimals.length : 0);
                      const tag = buildAutoEarTag(searchFarmer, knownCount);
                      setFormData((prev) => ({ ...prev, earTag: tag }));
                      toast.success(`Ear tag auto-generated: ${tag}`);
                    }}
                    className="btn btn-ghost btn-xs text-primary absolute top-0 right-0 gap-1 font-bold"
                  >
                    <Sparkles size={13} /> Auto-tag
                  </button>
                )}
              </div>
              <Select id="livestock-species" label="Species" required value={formData.species} onChange={updateField("species")} options={CATTLE_SPECIES} placeholder="" />
              <Select id="livestock-breed" label="Genetic breed" required value={formData.breed} onChange={updateField("breed")} options={BREED_OPTIONS_BY_SPECIES[formData.species] || CATTLE_BREEDS} placeholder="Select breed" />
              <Select id="livestock-color" label="Primary color" required value={formData.color} onChange={updateField("color")} options={CATTLE_COLORS} placeholder="Select color" />
              <Select id="livestock-gender" label="Sex" required value={formData.gender} onChange={updateField("gender")} options={["Female", "Male"]} placeholder="" />
              <Input id="livestock-brand" label="Brand name (optional)" value={formData.brand} maxLength={15} onChange={updateField("brand")} placeholder="e.g. Circle-X" />
              <Input id="livestock-birth-date" label="Birth date" required type="date" value={formData.dob} onChange={updateField("dob")} max={new Date().toISOString().split("T")[0]} />
            </div>
          </fieldset>
        </div>
      </form>
    </Modal>
  );
};

export default RegisterLivestockModal;

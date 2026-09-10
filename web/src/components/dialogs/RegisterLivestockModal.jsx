import { useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, Loader2, PawPrint, Upload, Search, X, AlertCircle, UserPlus } from "lucide-react";
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
import UserAvatar from "../ui/UserAvatar";

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
    return farmers.filter((farmer) => (farmer.name || "").toLowerCase().includes(query) || (farmer.phoneNumber || "").toLowerCase().includes(query));
  }, [farmers, searchFarmer]);

  const selectedFarmer = useMemo(() => {
    return farmers.find((f) => String(f._id) === String(formData.farmerName));
  }, [farmers, formData.farmerName]);

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
      setFormData({
        ...initialFormData,
        farmerName: preSelectedFarmer?._id || preSelectedFarmer?.id || "",
      });
      setSearchFarmer(preSelectedFarmer?.name || "");
      setImagePreview(null);
      setIsDropdownOpen(false);
    });
  }, [isOpen, livestock, preSelectedFarmer]);

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
          <legend className="fieldset-legend text-sm font-bold">Animal photo</legend>
          <label
            htmlFor="animal-photo"
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-base-300 bg-base-200 transition-colors hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Selected animal" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <Upload size={18} />
                </span>
                <span className="px-4 text-xs font-bold text-base-content/70">Upload or capture photo</span>
                <span className="text-[10px] font-semibold text-base-content/60">PNG, JPG, or WEBP</span>
              </span>
            )}
            <input id="animal-photo" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
          </label>
        </fieldset>

        <div className="space-y-6">
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-sm font-bold">Ownership details</legend>            <div className="relative">
              {preSelectedFarmer ? (
                <div className="flex h-12 items-center gap-3 rounded-field border border-base-300 bg-base-200 px-4">
                  <UserAvatar
                    name={preSelectedFarmer.name}
                    imageUrl={
                      preSelectedFarmer.imageUrl ||
                      preSelectedFarmer.avatarUrl ||
                      preSelectedFarmer.avatar
                    }
                    size={28}
                    sizeClass="h-7 w-7"
                  />
                  <span className="truncate font-semibold">
                    {preSelectedFarmer.name}
                  </span>
                </div>
              ) : (
                <label className="input w-full flex items-center gap-2">
                  {selectedFarmer ? (
                    <UserAvatar
                      name={selectedFarmer.name}
                      imageUrl={
                        selectedFarmer.imageUrl ||
                        selectedFarmer.avatarUrl ||
                        selectedFarmer.avatar
                      }
                      size={22}
                      sizeClass="h-5.5 w-5.5"
                    />
                  ) : (
                    <Search
                      size={16}
                      className="shrink-0 text-base-content/40"
                    />
                  )}
                  <input
                    className="grow min-w-0"
                    value={searchFarmer}
                    disabled={Boolean(livestock)}
                    onChange={(event) => {
                      setSearchFarmer(event.target.value);
                      setFormData((current) => ({ ...current, farmerName: "" }));
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => !livestock && setIsDropdownOpen(true)}
                    onBlur={() =>
                      window.setTimeout(
                        () => setIsDropdownOpen(false),
                        150,
                      )
                    }
                    placeholder="Search owner or farmer…"
                  />
                  {Boolean(searchFarmer || formData.farmerName) && !livestock && (
                    <button
                      type="button"
                      aria-label="Clear farmer selection"
                      className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/50 hover:text-base-content"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSearchFarmer("");
                        setFormData((current) => ({ ...current, farmerName: "" }));
                        setTimeout(() => setIsDropdownOpen(true), 0);
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </label>
              )}
              {isDropdownOpen && !livestock && (
                <div
                  id={ownerListId}
                  role="listbox"
                  aria-label="Matching farmers"
                  className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
                >
                  {isLoadingFarmers ? (
                    <div
                      className="space-y-3 p-4"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="skeleton h-10 w-full" />
                      <div className="skeleton h-10 w-full" />
                      <span className="sr-only">
                        Loading registered farmers
                      </span>
                    </div>
                  ) : isFarmersError ? (
                    <div className="space-y-3 p-4">
                      <div
                        role="alert"
                        className="alert alert-error alert-soft"
                      >
                        <AlertCircle size={16} />
                        <span className="text-sm">
                          {farmersError?.response?.data?.message ||
                            "Registered farmers could not be loaded."}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm w-full"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => refetchFarmers()}
                      >
                        Try again
                      </button>
                    </div>
                  ) : filteredFarmers.length ? (
                    filteredFarmers.map((farmer) => (
                      <button
                        key={farmer._id}
                        type="button"
                        role="option"
                        aria-selected={
                          formData.farmerName === farmer._id
                        }
                        className="flex w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 text-left hover:bg-base-200"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          setFormData((current) => ({ ...current, farmerName: farmer._id }));
                          setSearchFarmer(farmer.name);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <UserAvatar
                          name={farmer.name}
                          imageUrl={
                            farmer.imageUrl ||
                            farmer.avatarUrl ||
                            farmer.avatar
                          }
                          size={36}
                          sizeClass="h-9 w-9"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {farmer.name}
                          </span>
                          <span className="block truncate text-xs text-base-content/55">
                            {farmer.phoneNumber || "No phone number"}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="space-y-3 p-4 text-center">
                      <div>
                        <div className="font-semibold">
                          Farmer not found
                        </div>
                        <div className="text-sm text-base-content/55">
                          No matching registered farmer is available.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-sm font-bold">Animal details</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input id="livestock-ear-tag" label="Ear tag number" required value={formData.earTag} maxLength={3} onChange={updateField("earTag")} placeholder="e.g. 123" />
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

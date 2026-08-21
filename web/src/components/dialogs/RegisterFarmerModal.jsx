import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Loader2,
  BadgeCheck,
  Camera,
  Upload,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import iloiloPsgc from "../../constants/iloilo-psgc.json";
import { ILOILO_CITY_BARANGAYS_BY_DISTRICT } from "../../constants/barangays";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Select from "../ui/Select";

const parseIloiloCityBarangay = (value) => {
  if (value && value.includes("(") && value.includes(")")) {
    const match = value.match(/(.+?)\s*\(([^)]+)\)/);
    if (match) {
      return { brgy: match[1].trim(), district: match[2].trim() };
    }
  }
  return { brgy: value || "", district: "" };
};

const RegisterFarmerModal = ({
  isOpen,
  onClose,
  onSuccess,
  farmer = null,
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    barangay: "",
    city: "Oton",
    province: "Iloilo",
  });

  const targetBarangays = useMemo(() => {
    const selectedCity = formData.city || "Oton";
    if (selectedCity === "Iloilo City") {
      return ILOILO_CITY_BARANGAYS_BY_DISTRICT[selectedDistrict] || [];
    }
    return iloiloPsgc[selectedCity] || [];
  }, [formData.city, selectedDistrict]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const finalBarangay = data.city === "Iloilo City" && selectedDistrict
        ? `${data.barangay} (${selectedDistrict})`
        : data.barangay;

      if (farmer) {
        const payload = {
          name: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email || "",
          phoneNumber: data.phoneNumber,
          imageUrl: data.imageUrl,
          address: {
            barangay: finalBarangay,
            city: data.city,
            province: data.province,
            phoneNumber: data.phoneNumber,
          },
        };
        const res = await axiosInstance.patch(`/user/${farmer.id || farmer._id}/technician-update`, payload);
        return res.data;
      } else {
        const res = await axiosInstance.post("/technician/register-farmer", {
          ...data,
          imageUrl: data.imageUrl,
          address: {
            barangay: finalBarangay,
            city: data.city,
            province: data.province,
          },
        });
        return res.data;
      }
    },
    onSuccess: async (result) => {
      toast.success(farmer ? "Farmer profile updated successfully!" : "Farmer profile created successfully!");
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["technician"] }),
        queryClient.invalidateQueries({ queryKey: ["farmers", "list"] }),
      ]);
      onSuccess?.(result?.user || result?.data || result);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || (farmer ? "Failed to update profile." : "Registration failed."));
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (farmer) {
        const nameParts = (farmer.name || "").trim().split(" ");
        const first = nameParts[0] || "";
        const last = nameParts.slice(1).join(" ") || "";
        const rawBrgy = farmer.brgy || farmer.address?.barangay || "";
        const parsed = parseIloiloCityBarangay(rawBrgy);
        const city = farmer.address?.city || "Oton";
        Promise.resolve().then(() => {
          setSelectedDistrict(parsed.district);
          setImagePreview(farmer.imageUrl || farmer.profileImage || null);
          setFormData({
            firstName: first,
            lastName: last,
            phoneNumber: farmer.contact || farmer.phoneNumber || "",
            email: farmer.email || "",
            barangay: parsed.brgy,
            city: city,
            province: farmer.address?.province || "Iloilo",
          });
        });
      } else {
        Promise.resolve().then(() => {
          setSelectedDistrict("");
          setImagePreview(null);
          setFormData({
            firstName: "",
            lastName: "",
            phoneNumber: "",
            email: "",
            barangay: "",
            city: "Oton",
            province: "Iloilo",
          });
        });
      }
    }
  }, [farmer, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (e, field) => {
    const value = e.target.value.replace(/[^a-zA-Z\sñÑ-]/g, "");
    if (value.length <= 50) {
      setFormData({ ...formData, [field]: value });
    }
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
      return toast.error("Farmer profile photo must be 5 MB or smaller.");
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event?.preventDefault();
    if (mutation.isPending) return;
    if (!formData.firstName.trim()) {
      return toast.error("First name is required.");
    }
    if (!formData.lastName.trim()) {
      return toast.error("Last name is required.");
    }
    if (formData.phoneNumber.length < 11) {
      return toast.error("Phone number must be exactly 11 digits.");
    }
    if (!formData.phoneNumber.startsWith("09")) {
      return toast.error("Phone number must start with 09.");
    }
    if (!formData.barangay) {
      return toast.error("Barangay is required.");
    }
    if (!formData.city.trim()) {
      return toast.error("Municipality is required.");
    }
    if (formData.city === "Iloilo City" && !selectedDistrict) {
      return toast.error("Please select the Iloilo City district.");
    }
    mutation.mutate({ ...formData, imageUrl: imagePreview });
  };
  const toTitleCase = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const cityOptions = Object.keys(iloiloPsgc).map((city) => ({ value: city, label: city }));
  const districtOptions = Object.keys(ILOILO_CITY_BARANGAYS_BY_DISTRICT).map((district) => ({ value: district, label: district }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !mutation.isPending && onClose()}
      closeOnEscape
      title={farmer ? "Edit Farmer" : "Add New Farmer"}
      subtitle={farmer ? "Update the farmer's contact and location details." : "Register a new farmer to the system."}
      icon={<UserPlus size={22} className="text-primary" />}
      size="4xl"
      bodyClassName="space-y-6"
      actions={
        <>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="btn btn-ghost">Cancel</button>
          <button type="submit" form="register-farmer-form" disabled={mutation.isPending} className="btn btn-primary px-6">
            {mutation.isPending ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> Saving farmer…</> : <><BadgeCheck size={16} /> Save Farmer</>}
          </button>
        </>
      }
    >
      <form id="register-farmer-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
        <fieldset className="fieldset self-start">
          <legend className="fieldset-legend text-sm font-bold">Profile picture</legend>
          <label
            htmlFor="farmer-photo"
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-base-300 bg-base-200 transition-colors hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
          >
            {imagePreview ? (
              <div className="relative h-full w-full">
                <img src={imagePreview} alt="Farmer profile preview" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-2">
                  <Camera size={20} />
                  <span className="text-xs font-bold">Change photo</span>
                </div>
              </div>
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <Upload size={18} />
                </span>
                <div>
                  <span className="block text-xs font-bold text-base-content">Upload photo</span>
                  <span className="block text-[10px] font-medium text-base-content/60 mt-0.5">Profile picture</span>
                </div>
                <span className="text-[10px] font-semibold text-base-content/50">PNG, JPG, or WEBP</span>
              </span>
            )}
            <input id="farmer-photo" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
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
            <legend className="fieldset-legend text-sm font-bold">Personal information</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input id="farmer-first-name" label="First name" required value={formData.firstName} onChange={(event) => handleNameChange(event, "firstName")} maxLength={50} autoComplete="given-name" placeholder="e.g. Jane" />
              <Input id="farmer-last-name" label="Last name" required value={formData.lastName} onChange={(event) => handleNameChange(event, "lastName")} maxLength={50} autoComplete="family-name" placeholder="e.g. Doe" />
              <Input id="farmer-phone" label="Contact number" required type="tel" value={formData.phoneNumber} onChange={(event) => { const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 11); setFormData({ ...formData, phoneNumber: value }); }} pattern="09[0-9]{9}" maxLength={11} inputMode="numeric" autoComplete="tel" hint="Use an 11-digit Philippine mobile number beginning with 09." placeholder="e.g. 09123456789" />
              <Input id="farmer-email" label="Email address (optional)" type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} autoComplete="email" placeholder="e.g. jane.doe@example.com" />
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-sm font-bold">Location information</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select id="farmer-city" label="Municipality or city" required value={formData.city || "Oton"} options={cityOptions} placeholder="" onChange={(event) => { const city = event.target.value; setFormData({ ...formData, city, barangay: "" }); setSelectedDistrict(""); }} />
              {formData.city === "Iloilo City" && <Select id="farmer-district" label="District" required value={selectedDistrict} options={districtOptions} placeholder="Select district" onChange={(event) => { setSelectedDistrict(event.target.value); setFormData({ ...formData, barangay: "" }); }} />}
              <Input id="farmer-barangay" label="Barangay" required value={formData.barangay ? toTitleCase(formData.barangay) : ""} onChange={(event) => setFormData({ ...formData, barangay: event.target.value })} list="farmer-barangay-options" autoComplete="address-level3" placeholder="Type or select a barangay" />
              <datalist id="farmer-barangay-options">{targetBarangays.map((barangay) => <option key={barangay} value={toTitleCase(barangay)} />)}</datalist>
            </div>
          </fieldset>
        </div>
      </form>
    </Modal>
  );
};

export default RegisterFarmerModal;


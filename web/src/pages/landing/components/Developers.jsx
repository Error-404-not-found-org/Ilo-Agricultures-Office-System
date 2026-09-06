import { Mail } from "lucide-react";

const DEVELOPER_PROFILES = [
  {
    name: "Gian Rovik Somes",
    role: "Documenter",
    image:
      "https://res.cloudinary.com/donhulins/image/upload/v1788677242/791819717_1056285247148312_3305248414260831497_n_knnsjx.jpg",
    email: "gianroviks@gmail.com",
  },
  {
    name: "Nelmar Buenafe",
    role: "UI/UX Designer",
    image:
      "https://res.cloudinary.com/donhulins/image/upload/v1788677442/file_00000000e1708206a8301e72715177e3_ygiob7.png",
    email: "buenafenelmar7@gmail.com",
  },

  {
    name: "John Lloyd Cabanig",
    role: "Project Manager/Backend Developer",
    image:
      "https://res.cloudinary.com/donhulins/image/upload/v1788677450/file_0000000045cc8206bacf1a0fe1a381fa_lmvfh4.png",
    email: "cabanigjohnlloyd@gmail.com",
  },
  {
    name: "John Arvy Lopez",
    role: "Web Developer",
    image:
      "https://res.cloudinary.com/donhulins/image/upload/v1788677456/file_00000000998c8206a808906b0c404789_ydkyyy.png",
    email: "johnarveylopez0@gmail.com",
  },
  {
    name: "Justine Balmores",
    role: "Documenter/QA Tester",
    image:
      "https://res.cloudinary.com/donhulins/image/upload/v1788677595/619515361_1631026208238471_9013519744835559738_n_qqsbwo.jpg",
    email: "usap.balmores.ui@phinmaed.com",
  },
];

export default function Developers() {
  return (
    <section
      id="developers"
      data-motion-section
      className="bg-[#F5F2E8] py-28 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div data-motion-intro className="flex items-center gap-4 mb-16">
          <span className="font-mono-brand text-[#1A5C35] text-[11px] uppercase tracking-wider">
            Developers
          </span>
          <div className="flex-1 h-px bg-[#061A0E]/10" />
        </div>

        {/* Header Content */}
        <div data-motion-intro className="grid md:grid-cols-2 gap-16 mb-16">
          <h2 className="font-display font-bold text-[#061A0E] text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight">
            The team behind
            <br />
            <span className="text-[#0D3320]">BreedSmart</span>
          </h2>
          <p className="text-[#061A0E]/60 text-[1.1rem] leading-relaxed self-end">
            A dedicated team of developers, designers, and agricultural
            technology specialists working together to modernize livestock
            management in Oton, Iloilo.
          </p>
        </div>

        {/* Developer Profiles - 5 in one row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-[#061A0E]/10">
          {DEVELOPER_PROFILES.map((developer) => {
            const [user, domain] = developer.email?.split("@") || [];

            return (
              <div
                key={developer.name}
                data-motion-item
                className="bg-[#F5F2E8] p-6 group hover:bg-white transition-colors duration-200 text-center last:col-span-2 lg:last:col-span-1"
              >
                {/* Profile Image */}
                <div className="w-16 h-16 rounded-full overflow-hidden mb-4 mx-auto bg-[#0D3320]/10">
                  <img
                    src={developer.image}
                    alt={`${developer.name} - ${developer.role}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Name & Role */}
                <h3 className="font-display font-bold text-[#061A0E] text-[1rem] leading-tight mb-1 group-hover:text-[#0D3320] transition-colors duration-200">
                  {developer.name}
                </h3>
                <p className="font-mono-brand text-[#1A5C35] text-[10px] uppercase tracking-wider mb-3">
                  {developer.role}
                </p>

                {/* Bio */}
                <p className="text-[#061A0E]/60 text-[12px] leading-relaxed mb-4">
                  {developer.bio}
                </p>

                {/* Email Link */}
                <a
                  href={user && domain ? `mailto:${user}@${domain}` : "#"}
                  className="inline-flex items-center gap-1.5 text-[#061A0E]/40 hover:text-[#0D3320] transition-colors duration-200 text-[11px] font-mono-brand"
                >
                  <Mail size={12} />
                  {user && domain ? `${user}@${domain}` : "Email"}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

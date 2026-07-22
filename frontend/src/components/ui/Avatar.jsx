export default function Avatar({ name = "U", size = "md", src }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-[#E21B70] to-[#3A0519]
                     flex items-center justify-center font-bold text-white shrink-0 select-none`}>
      {src ? <img src={src} className="w-full h-full rounded-full object-cover" alt={name}/> : initials}
    </div>
  );
}

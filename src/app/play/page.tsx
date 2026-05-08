import F1Game from "@/components/F1Game";

export const metadata = {
  title: "F1 Helicopter | F1 Fantasy League",
  description: "Dodge the barriers in this F1 mini game",
};

export default function PlayPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <span className="text-red-500">F1</span> Helicopter
      </h1>
      <F1Game />
    </div>
  );
}

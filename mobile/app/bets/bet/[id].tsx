import { useLocalSearchParams } from "expo-router";
import BetScreen from "../../../src/bettracker/Screen";
import BetForm from "../../../src/bettracker/screens/BetForm";

/** "new" yeni bahis demek; başka bir değer mevcut bahsin kimliği. */
export default function BetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <BetScreen>
      <BetForm betId={id ?? "new"} />
    </BetScreen>
  );
}

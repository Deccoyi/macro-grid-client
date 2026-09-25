import { ScreenOrientation } from "@capacitor/screen-orientation";
import { callNative } from "./bridge";

/** Locks the screen to portrait/landscape, or unlocks it again when the setting is "auto". */
export function setOrientation(orientation: "auto" | "portrait" | "landscape"): void {
  if (orientation === "auto") callNative(() => ScreenOrientation.unlock());
  else callNative(() => ScreenOrientation.lock({ orientation }));
}

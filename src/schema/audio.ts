import { CATALOG_HULLS } from "./catalog.ts";

/**
 * AUDIO LAW v2 — bake once, play the file.
 * Listen never calls ElevenLabs or any TTS API.
 * Missing mp3 falls back to the browser voice until the bake lands.
 */
export const AUDIO_LAW = {
  version: 2,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  garageBrief: true,
  autoplay: false,
  runtimeTtsApi: false,
  playBakedMp3: true,
  fallbackSpeech: true,
  bake: "once" as const,
  src: "/audio/briefs/{hullId}.mp3",
  deferred: ["elevenlabs-voice-id", "engine-loop", "gun-shot", "explosion", "weather-bed", "map-music"],
} as const;

export type Brief = {
  hullId: string;
  title: string;
  src: string;
  script: string;
};

function B(hullId: string, title: string, script: string): Brief {
  return { hullId, title, src: `/audio/briefs/${hullId}.mp3`, script };
}

export const BRIEF_VOICE_CARD =
  "Gruff, gravelly American briefing NCO. Low, worn, close to the mic. Dry contempt for thin armor. Respects a gun that pens. Never cheerful. Never says bub.";

export const BRIEFS: Brief[] = [
  B(
    "m2a4",
    "Light Tank M2A4",
    "M two A four. First light we admit to. Twenty-five millimetres of polite suggestion and a thirty-seven that thought it was a cannon. Two-man turret. Commander loads, which means the man who should be looking is busy stuffing brass. This hull taught the United States how to build a tank. Then we spent the rest of the war pretending we hadn't. The Stuarts grew out of it. Pacific still scouted in it. Europe would have laughed. You want a Tiger? You want a funeral. Scout. Don't trade. Come home.",
  ),
  B(
    "m3-stuart",
    "M3 Stuart",
    "M three. The Honey. Brits named it that because it started in the morning. Same thirty-seven family, taller turret, a gyro that made the gun less of a drunk. Desert and Pacific. Against Japanese plate it was a bully. Against a Panzer three it was a rumor. Influence is ugly and true: we could ship a reliable light in numbers, and numbers do not care if your shell bounces. Use the speed. Use the radio. Do not sit in a gunfight you already lost in thirty-nine.",
  ),
  B(
    "m5-stuart",
    "M5 Stuart",
    "M five. Twin Cadillacs. Automatic box. Sloped nose on the old M three bones. Quiet. Fast. Still swinging a thirty-seven in forty-four like the war had the decency to wait. Last of that light line before the Chaffee grew up. It finished the Stuart the way a last cigarette finishes a habit. Lesson: a light that cannot pen the thing in front of it is a loud staff car. Drive it like you mean to see tomorrow. Not like you mean to be a hero.",
  ),
  B(
    "m24-chaffee",
    "M24 Chaffee",
    "Chaffee. Finally a light with a grown gun. Seventy-five millimetre M six, torsion bars, a turret that doesn't look like a bucket. Late to Europe. Right on time for Korea, where it still had to look a T thirty-four in the mouth and pretend it liked the view. First American light that could ruin a Panther's afternoon from the side. That's the job. Not a duel down the boulevard. A knife in the ribs, then gone. If you park this thing, you have misunderstood the assignment.",
  ),
  B(
    "m4a3-sherman",
    "M4A3 Sherman",
    "Sherman. M four A three. Ford GAA, seventy-five millimetre M three, the tank that arrived. Not the best tank of forty-four. The one that showed up, got repaired, and showed up again. Eighteen thousand of the A three alone. Influence isn't poetry. It's a workshop in England turning wrecks around while some genius heavy is still waiting on a train. A Tiger will bounce you. Fine. There will be five more of you. That is not glory. That is how a war gets won. Stay in the fight. Don't make me write your mother.",
  ),
  B(
    "m4a3e8",
    "M4A3(76)W Easy Eight",
    "Easy Eight. Same Sherman that wouldn't die, now with a seventy-six, wet racks, and springs that don't beat the crew to death. Horizontal volute. Twenty-three inch tracks. The Bulge. The ride into Germany. This is the Sherman that could finally argue with a Panther's mantlet instead of just annoying it. Influence: you don't throw away a hull that works. You put a real gun on it and you keep the line moving. If you still bounce, you move. You do not sit there and pray. Prayer is not a fire control system.",
  ),
  B(
    "m26-pershing",
    "M26 Pershing",
    "Pershing. Ninety millimetre M three. Torsion bars. A heavy that showed up dressed as a medium and late to its own party. Most of Europe was over. Cologne wasn't. A Tiger found that out the hard way. Korea proved the ninety could talk to a T thirty-four without stuttering. This is where the Sherman stops being the main argument. Slow. Thick face. One ring. You aim that ninety like it owes you money. Because it does. We waited long enough for it.",
  ),
  B(
    "m46-patton",
    "M46 Patton",
    "M forty-six. A Pershing that finally got an engine with a pulse. Continental A V seventeen ninety, bore evacuator, same ninety with better manners. Korea was its war. Taught the Army the Pershing wasn't under-gunned. It was under-lunged. First hull to wear the Patton name. That's not a compliment. That's a warning that the next twenty years of American armor start in this greasy, honest machine. Don't get romantic. Get the gun on target.",
  ),
  B(
    "m47-patton",
    "M47 Patton",
    "M forty-seven. New turret, old M forty-six hips, ninety millimetre M thirty-six and a rangefinder that made lieutenants feel clever. Rushed for Korea. Missed Korea. So we sold it to half of NATO instead. Italy, Germany, France, Turkey. Influence: American fire control in everybody else's yard while Detroit tooled the forty-eight. Still has the old bow-gun habit. Later Pattons grew out of it. This one hasn't. Treat it like a cousin who showed up armed and useful. Not pretty. Present.",
  ),
  B(
    "m48-patton",
    "M48 Patton",
    "M forty-eight. Hemisphere turret. Ninety millimetre M forty-one. No bow machine gun, thank Christ. First Patton designed as itself, not a Pershing in a new hat. Vietnam's tank. The silhouette America wore for twenty years. Cast hull, workshop-simple, crew-safe if you don't do something stupid. One ring. Thick face. You aim the ninety and you let the infantry love you or hate you. They will do both. That's armor. That's the job.",
  ),
  B(
    "m7-priest",
    "M7 Priest",
    "Priest. Open-top church with a one hundred five millimetre M two A one where the sermon should be. M three Lee chassis. It is not a tank. If you treat it like one, the sky will invent a new way to kill you. Direct fire is a leftover cone of thirty degrees for when something ugly walks into the parking lot. Lob is the point. Sixteen to one hundred ten metres on this yard. High-arc H E. Splash that chips what you missed. El Alamein to the Rhine, this was the Army's self-propelled one-oh-five. Every later American S P G still thinks like this mean, honest box. Drop it on them. Then move.",
  ),
  B(
    "t-28",
    "T-28",
    "Ah! The T-28. Look at this beautiful, confused machine. Three turrets. Three opinions. Seventy-six-millimeter KT-28 in the big ring, DT machine guns in the hull like the nineteen-thirties promised a navy on land.\nIs this sophisticated tank? For nineteen thirty-two, yes. Is it good idea? No! Too many men, too little steel, too much conversation.\nWinter War takes this concept behind shed and shoots it. Hull is long, thin, and full of elbows. What survives is the lesson: one gun, one commander, slope the plates next time.\nUntil then, pick a ring and commit. Do not try to be battleship. Battleship belongs in water. This belongs in museum. And also in your garage, because we are sentimental.",
  ),
  B(
    "t-28e",
    "T-28E",
    "Ah! The T-28E. Same circus, extra plates. After Finland, someone bolts on more millimetres like shame you can measure with calipers.\nIs this new tank? No. Is it thicker tank? Slightly. Still three rings. Still land battleship. Still a dead end with better coat.\nBut listen: this machine buys months while T-34 is being born in the factories. That is the only mercy a bad tank receives. You cannot appliqué your way out of stupid shape. You will bounce a little more. You will still be a boat on tracks.\nAim the three rings if you must. Then go invent T-34 like grown country. And do not believe extra armor is personality. Is just extra armor.",
  ),
  B(
    "t-34",
    "T-34",
    "Ah! The T-34. Look at this beautiful, angry machine. Forty-five-millimeter glacis on a slope that makes the rest of the world take notes. Seventy-six-millimeter F-34. Christie bones. Engine that sounds as if it has swallowed a tractor and the tractor is still arguing.\nIs this sophisticated tank? In the important ways, yes. Is every weld a poem? No! Poems do not come off the line at Nizhny Tagil while the front is on fire.\nGermany copies the idea and calls it Panther. Cute. This tank does not win because it is pretty. It wins because the factory keeps breathing. One ring. Hide the side. Show the slope. If commander presents flank like tourist, enemy does not need clever gun. He only needs functioning eyes.\nTreat the angles with respect. The steel is not magic. The slope is the magic.",
  ),
  B(
    "t-34-85",
    "T-34-85",
    "Ah! The T-34-85. After Kursk, someone is tired of bouncing off Tigers, so they put eighty-five-millimeter ZiS-S-53 in a three-man turret. Commander can stop loading and start commanding. Miracle.\nIs this new tank? No. Same hull. New bite. Same mean silhouette the world still means when it says Soviet tank. They do not replace T-34. They make it hungry.\nYou want conversation with Tiger? Now you have conversation. Do not waste it showing him the side. Side is still a rumor. Front is still a wall if you keep the slope honest.\nKeep the cannon fed. Keep the infantry close. And if turret race makes funny noise, that is not personality. That is the race. Unless it always makes this noise. Then—is probably fine.",
  ),
  B(
    "t-44",
    "T-44",
    "Ah! The T-44. Look at this lower, angrier child of T-34. Engine turned sideways. Torsion bars. Hull like someone sat on the barn door and said, be knife now. Still eighty-five-millimeter. Too late to punch Germany. Too early to carry the hundred.\nIs this famous tank? No. Is it important tank? Yes! Every Soviet medium after this is this machine from the engine bay forward. Not a parade. A factory decision that never gets undone.\nIf you miss T-34 height, good. You were a barn. Try being a knife. One ring. Glacis is the future. Do not sit in the open congratulating yourself on how modern you look. Modern is not armor. Modern is not being where the shell is going.",
  ),
  B(
    "t-44-100",
    "T-44-100",
    "Ah! The T-44-100. They stuff D-10T one-hundred-millimeter into the forty-four to see if a medium can carry a real gun. Look at this beautiful experiment.\nIs this the answer? Almost. Army takes the lesson and builds T-54 instead of pretending this hull is finished. That is correct. Trials tank teaches the next guy. It does not always save you.\nOn this tree, this is first Soviet hull that can look a Panther in the face without blinking first. Do not get cocky. Cocky is how experiments become wrecks. Keep the gun honest, keep the slope honest, and do not treat prototype like it has a pension. It has a job: prove the hundred belongs here. Then get out of the way.",
  ),
  B(
    "t-54",
    "T-54-1",
    "Ah! The T-54. Look at this beautiful, angry hymn of the Warsaw Pact. One-hundred-millimeter glacis at sixty degrees. D-10T. A dome still deciding what a turret is supposed to look like.\nIs this sophisticated tank? For its time, yes. Is it everywhere? Also yes. They build more of these than any other tank in the history of good decisions and bad ones. If a map after Korea has a Soviet medium on it, this idea is already in the soil.\nEarly turret. Same law. One ring. You do not out-clever this glacis. You out-angle it, or you go home in a bag. Treat the machine with respect. Keep infantry close. And never charge alone across open field. Enemy does not need advanced fire-control. He only needs functioning eyes.",
  ),
  B(
    "t-54b",
    "T-54-2",
    "Ah! The T-54-2. The one they actually issue. Early dome, D-10T, glacis already at that ugly perfect one hundred at sixty. Stabilizer work starts here, which means some poor gunner can finally hit what he is looking at. Imagine.\nIs this new tank? No. Is it the photograph? Yes. Budapest. Sinai. Every picture of a Soviet tank that makes a politician sweat. Not a new machine. The one that shows up. That is worse. That is better.\nPoint the hundred and do not give a speech. Speeches are for parades. This is for the field. If the dome looks old-fashioned, good. Old-fashioned steel at sixty degrees is still a problem. Unless commander parks on a skyline. Then is just a monument.",
  ),
  B(
    "t-62",
    "T-62",
    "Ah! The T-62. Look at this beautiful, rude machine. One-hundred-fifteen-millimeter smoothbore. First of its kind that is not a science fair. A Patton face used to argue with D-10T. This thing ends the argument.\nIs this T-54 with longer stick? No! Is the engine still a tractor having opinions? Yes.\nEvery later Soviet gun is a smoothbore because this one works and the old rifled pride does not. Flush dome. One ring. You are the reason the next twenty years of gunnery sounds like a different war.\nHit them. Then hit them again. Autoloader keeps the cannon hungry. Armor is not magic. If commander charges alone, enemy does not need new computer. He only needs the old one, and a little patience. Keep infantry close. Listen to the engine. Unless it always makes this noise. Then—is probably fine.",
  ),
  B(
    "t-64a",
    "T-64A",
    "Ah! The T-64A. Look at this secret, expensive, nervous genius. Composite glacis. Autoloader. Light hull with heavy ideas and a carousel under the seats that makes chaplains sweat.\nIs this sophisticated tank? Yes. Is it comfortable? No! Comfort is for passenger train. Is it reliable like T-54? Also no.\nThis machine is so clever they must invent T-72 so the rest of the army can afford to exist. Homogeneous steel stops being enough here. Crews sit low now because of this thing.\nHandle it like a scalpel. It is not a T-54. If you drive it like a T-54, it will remind you. Keep the autoloader fed, keep the suspicious noises catalogued, and never ignore the engine unless it always makes this noise. Then—is probably fine. Probably.",
  ),
  B(
    "su-76",
    "SU-76",
    "Ah! The SU-76. Look at this beautiful, honest box. Open casemate. Seventy-six-millimeter ZiS-3 on a lengthened T-70 that already has one foot in the grave. Poor man's assault gun. Fourteen thousand of them.\nIs this sophisticated tank? No. Is it a tank? Also no! Comfort is for people with a roof. Infantry loves it because it is there when the pretty machines are somewhere else being famous.\nThis is our Priest. Howitzer that can still fire direct, hull that will not take a punch. Lob is the honest use. Do not duel a Panther. That is not bravery. That is a joke with a punchline you do not walk away from.\nKeep infantry close. Drop the shell. Then move. And if the engine sounds like it has swallowed a tractor—good. That is the tractor. We put it there on purpose.",
  ),
  B(
    "tiger-i",
    "Tiger I",
    "Behold. The Tiger. Panzerkampfwagen six. Eighty-eight-millimeter KwK thirty-six. One hundred millimetres of frontal conviction. A hydraulic ring that traverses as though it has read the contract.\nIs this a common tank? Thankfully, no. Quantity is an American consolation. After Tunisia, every Allied briefing assumed a Tiger behind the next hedge. One does not need a thousand machines if a few hundred will occupy the enemy's imagination.\nNaturally, it is thirsty. Naturally, it is rare. A masterpiece is not a bus. Aim the eighty-eight. Do not waste it on a barn. Do not confuse this with a Sherman that arrives in a crate. This is a rumor that happens to be true. And the rumor, I assure you, was understated.",
  ),
  B(
    "tiger-ii",
    "Tiger II",
    "The King Tiger. One hundred fifty millimetres of glacis. The KwK forty-three eighty-eight, which ruins a day at a distance polite people call unfair.\nIs this excessive? Only if one has modest ambitions. The thickest face on this tree until the paper tanks begin to dream. Too heavy for most bridges. One notes, of course, that the bridges were not designed by us.\nIt ended the German heavy not because it failed, but because the next millimetre of armor costs the army the tank. You will bounce what this yard throws at the bow. You will not bounce physics. Drive it like a vault. Not like a horse. Horses are for people who did not bring an eighty-eight.",
  ),
  B(
    "panther",
    "Panther Ausf. D/A",
    "The Panther. Seven-point-five-centimetre KwK forty-two. Sloped glacis. One ring. The T-34 had an idea. We finished it.\nIs this a copy? Please. A copy does not write a better gun in the margin. Early final drives were... temperamental. A masterpiece may have a difficult childhood. When this machine ran, nothing in forty-four wished to see the front of it.\nFor a decade, everybody else's medium was an answer to this. Slope plus a long seventy-five. That is the law. Hide the side if you must. The side is a courtesy. The face is a verdict.",
  ),
  B(
    "panther-g",
    "Panther Ausf. G",
    "Panther G. Same KwK forty-two. Fifty-millimetre sides. A chin mantlet, so the shot trap might stop eating loaders. One improves even perfection when the loaders complain.\nIs this a new religion? No. It is the Panther that actually reached battalions in forty-five. Production, you see, is also an art. Drawings do not hold a ridge. This did. Until the fuel ran out. Until everything ran out.\nTreat the side as a suggestion. Treat the face as a debt. You still have the gun. Use it. And do try not to drive it like a tractor. That would be provincial.",
  ),
  B(
    "panther-f",
    "Panther Ausf. F",
    "Panther F. The Schmalturm. A narrow turret, still the KwK forty-two, a smaller face meant to thicken the plate without dragging a Tiger's weight behind it. Almost nobody finished one. The war, as usual, lacked patience.\nIs this a failure? How charming. It is the last honest Panther, and the sketch German engineers carried into the standard programs after the shooting stopped. One ring. Smaller shot trap. The future of German armor without the vulgar cathedral bow.\nIf you wanted the idea without the sermon, you are looking at it. Shame the calendar did not wait. Calendars so rarely do.",
  ),
  B(
    "jagdpanther",
    "Jagdpanther",
    "Jagdpanther. A casemate. Eight-point-eight-centimetre Pak forty-three. No ring. Leftover eleven degrees, which is a polite way of saying you are the gun.\nIs this a limitation? Only to people who require a turret to feel complete. A Panther hull with a fixed eighty-eight was more tank than a Tiger still waiting on a railhead. Ambush is not cowardice. Ambush is editing.\nDo not swing. If you must track, yaw the entire hull and live with the dignity of it. This is not a duelist. This is a theorem with tracks. Pick the moment. Then end the discussion.",
  ),
  B(
    "wespe",
    "Wespe",
    "Wespe. The wasp. A ten-point-five-centimetre leFH on a Panzer two chassis that had already retired from being a tank. Open top. Same class gate as the American Priest, which is a sentence I say only under protest.\nIs this glamorous? It is not supposed to be glamorous. It is supposed to be correct. The Wehrmacht's mass self-propelled howitzer in the West, cheap because the chassis was already... experienced.\nYou are artillery. Act like it. Lob. Do not duel. The sky is your department. The street fight is for people with roofs and poorer taste. If the blast seems smaller than a Priest, restrain your envy. Caliber is not character. Character is hitting what one intended.",
  ),
  B(
    "e-50",
    "E-50",
    "E-fifty. Paper. Yes. Paper. The standard medium that would have replaced Panther and Tiger with one set of parts, so the workshops might stop weeping into two incompatible manuals.\nIs it unbuilt? The world was busy. Eighty-eight-class gun, a proper ring, sloped hull, never issued, never late to a bridge. Influence: this is the ghost inside Leopard. When German engineers began again after the war, they began here, not from another church of thick bows.\nA drawing is not a battalion. Obviously. A correct drawing, however, is how battalions are born. Try to keep up.",
  ),
  B(
    "e-75",
    "E-75",
    "E-seventy-five. The paper heavy. Same standard program as the fifty, thicker face, still one ring, still unbuilt. Late-war Germany wanted this instead of two incompatible heavies that could not share a wrench. A reasonable request. History declined.\nIs a thicker drawing still a drawing? Yes. Is it also the correct instinct? Also yes. On this tree it looks like a monster. In history it looks like a wish. Drive the wish carefully.\nWishes, unlike Shermans, are not produced by the thousand. That is rather the point.",
  ),
  B(
    "standardpanzer",
    "Standardpanzer",
    "Standardpanzer. The Bundeswehr prototype that grew up and permitted itself to be called Leopard. Rollers. A one-hundred-five-millimetre path. Mobility first, armor second, pride in the tool crib where it belongs.\nIs this a betrayal of the Tiger? It is an education. You do not live because the bow is a cathedral. You live because you are not standing where the shell arrives. That argument won NATO. You are driving it.\nIf you sit still in this machine waiting to bounce a hundred millimetres of someone else's certainty, you have misunderstood the entire second half of the century. I will not explain it twice.",
  ),
  B(
    "leopard-1",
    "Leopard 1",
    "Leopard one. One-hundred-five-millimetre L seven. One ring. Armor that will not stop a T-54 at fighting range. Deliberate. We refused the Tiger's vulgar bargain on purpose.\nIs this cowardice? How American. Speed. Sights. A gun that hits first. It rearmed half of NATO and taught the West a postwar tank could decline to be a bunker.\nProtection by not being hit. If that offends you, there is always a King Tiger and a bridge that cannot take it. If you sit still in this, you have already lost. Move. See. Kill. Leave. And do try to look as if you understood the philosophy.",
  ),
];


export const BRIEFS_BY_ID: Record<string, Brief> = Object.fromEntries(BRIEFS.map((b) => [b.hullId, b]));

export function briefFor(hullId: string): Brief | undefined {
  return BRIEFS_BY_ID[hullId];
}

export function assertBriefsCoverCatalog(): void {
  for (const h of CATALOG_HULLS) {
    if (!BRIEFS_BY_ID[h.id]) throw new Error("brief missing " + h.id);
  }
}

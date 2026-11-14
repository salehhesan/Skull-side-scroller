# Skullnaut — Ignite the Red Planet

A side-scrolling action game starring a skull-headed astronaut. Shoot, punch and double-jump across a red planet, then unleash the **Fire Breath** ultimate on the boss, Warden-9.

## Play
Open `index.html` in any modern browser. No build step is needed. It works with a keyboard and has on-screen buttons on touch devices.

| Action | Keys |
|---|---|
| Move | A / D or ← / → |
| Jump / double jump | W / Space / ↑ |
| Shoot blaster (hold) | J or X |
| Punch (smashes crates, parries bullets) | K or Z |
| **Fire Breath ultimate** (when meter is full) | L or C |
| Crouch (needed to shoot slimes) | S / ↓ |
| Drop through platform | S + Jump |
| Stomp | Jump on an enemy |
| Pause / Mute | P / M |

Kill enemies, punch things and grab batteries to charge the Fire Breath meter.

The player character is hand-drawn in code in `skullnaut.js` (rig with knees, elbows and jaw). It is inlined into `index.html` between the `/*SN-BEGIN*/` and `/*SN-END*/` markers so the game stays a single file.

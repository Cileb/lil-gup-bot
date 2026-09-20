const REACTION_ROLE_CATEGORIES = [
  {
    slug: "game_version",
    title: "Game Version",
    description: "React to select which version(s) of WoW you play.",
    options: [
      { emojiName: "wowretail", roleName: "WoW - Retail" },
      { emojiName: "wowforever", roleName: "WoW - Forever" },
    ],
  },
  {
    slug: "role",
    title: "Role",
    description: "React to select your role(s).",
    options: [
      { emojiName: "tank", roleName: "Tank" },
      { emojiName: "healer", roleName: "Healer" },
      { emojiName: "dps", roleName: "DPS" },
    ],
  },
  {
    slug: "professions",
    title: "Professions",
    description: "React to select your profession(s).",
    options: [
      { emojiName: "alchemy", roleName: "Alchemy" },
      { emojiName: "blacksmithing", roleName: "Blacksmithing" },
      { emojiName: "enchanting", roleName: "Enchanting" },
      { emojiName: "engineering", roleName: "Engineering" },
      { emojiName: "skinning", roleName: "Skinning" },
      { emojiName: "leatherworking", roleName: "Leatherworking" },
      { emojiName: "tailoring", roleName: "Tailoring" },
      { emojiName: "herbalism", roleName: "Herbalism" },
      { emojiName: "mining", roleName: "Mining" },
    ],
  },
];

module.exports = REACTION_ROLE_CATEGORIES;
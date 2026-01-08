import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
  console.log('🎲 Seeding test data...\n');

  // Find or create user (using actual Clerk ID)
  const testUser = await prisma.user.upsert({
    where: { clerkId: 'user_37woq4gAbfe2lRPIwgdNDVktXws' },
    update: {},
    create: {
      clerkId: 'user_37woq4gAbfe2lRPIwgdNDVktXws',
      email: 'jax.hutton@comcast.net',
      name: 'Jax',
    },
  });
  console.log('✓ User created/found:', testUser.email);

  // Create example campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: 'test-campaign-curse-of-strahd' },
    update: {},
    create: {
      id: 'test-campaign-curse-of-strahd',
      name: 'Curse of Strahd',
      description: 'A gothic horror adventure in the demiplane of Barovia, where the players must confront the vampire lord Strahd von Zarovich.',
      worldContext: `Setting: Barovia - A dark, mist-shrouded valley ruled by the vampire Count Strahd von Zarovich. The land is trapped in eternal gloom, cut off from the rest of the world by deadly mists.

Key Locations:
- Village of Barovia: A gloomy village of fearful peasants
- Castle Ravenloft: Strahd's fortress, perched atop a cliff
- Vallaki: A fortified town with a corrupt burgomaster
- The Amber Temple: Ancient temple hiding dark secrets
- Argynvostholt: Ruined mansion of a fallen order of knights

Themes: Horror, despair, moral ambiguity, redemption
Tone: Dark and gothic, but with moments of hope

Important NPCs controlled by DM:
- Strahd von Zarovich: The vampire lord, charming yet terrifying
- Ireena Kolyana: A woman Strahd believes is his reincarnated love
- Ismark the Lesser: Ireena's protective brother
- Madam Eva: A Vistani seer who reads fortunes
- Ezmerelda d'Avenir: A vampire hunter
- Van Richten: Legendary monster hunter in disguise`,
      userId: testUser.id,
    },
  });
  console.log('✓ Campaign created:', campaign.name);

  // Create players
  const players = [
    {
      id: 'player-1-sarah',
      playerName: 'Sarah',
      characterName: 'Elara Moonwhisper',
      characterClass: 'Cleric',
      characterRace: 'Half-Elf',
      maxHp: 45,
      currentHp: 38,
      notes: 'Worships Lathander. Has a personal vendetta against undead after her village was attacked.',
    },
    {
      id: 'player-2-mike',
      playerName: 'Mike',
      characterName: 'Thorgrim Ironforge',
      characterClass: 'Fighter',
      characterRace: 'Dwarf',
      maxHp: 67,
      currentHp: 67,
      notes: 'Former soldier. Carries his grandfather\'s warhammer. Distrustful of magic.',
    },
    {
      id: 'player-3-alex',
      playerName: 'Alex',
      characterName: 'Zephyr',
      characterClass: 'Rogue',
      characterRace: 'Tiefling',
      maxHp: 38,
      currentHp: 25,
      notes: 'Reformed pickpocket. Looking for information about their missing sibling.',
    },
    {
      id: 'player-4-jordan',
      playerName: 'Jordan',
      characterName: 'Aldric Stormwind',
      characterClass: 'Wizard',
      characterRace: 'Human',
      maxHp: 32,
      currentHp: 32,
      notes: 'Scholar from Waterdeep. Fascinated by the dark magic of Barovia. Keeps detailed notes.',
    },
  ];

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: player,
      create: {
        ...player,
        campaignId: campaign.id,
      },
    });
  }
  console.log(`✓ ${players.length} players created`);

  // Create NPCs
  const npcs = [
    {
      id: 'npc-strahd',
      name: 'Strahd von Zarovich',
      description: 'The vampire lord of Barovia. Elegant, charming, and utterly terrifying. Centuries old, he is obsessed with Ireena Kolyana.',
      speechPatterns: 'Speaks with formal, old-world elegance. Often philosophical. Uses "my dear" and "how delightful". Voice is smooth and hypnotic.',
    },
    {
      id: 'npc-ireena',
      name: 'Ireena Kolyana',
      description: 'A young noblewoman with auburn hair. Strong-willed and brave despite being hunted by Strahd. Bears bite marks on her neck.',
      speechPatterns: 'Speaks with quiet determination. Polite but guarded with strangers. Becomes passionate when discussing protecting her people.',
    },
    {
      id: 'npc-ismark',
      name: 'Ismark the Lesser',
      description: 'Ireena\'s brother, the burgomaster\'s son. Called "the Lesser" because he hasn\'t lived up to his father\'s legacy. Desperate to protect his sister.',
      speechPatterns: 'Direct and earnest. Sometimes frustrated. Uses simple, honest language.',
    },
    {
      id: 'npc-madam-eva',
      name: 'Madam Eva',
      description: 'Ancient Vistani seer who dwells at Tser Pool. Knows far more than she reveals. Her card readings shape destinies.',
      speechPatterns: 'Cryptic and mysterious. Speaks in riddles and prophecies. Heavy accent. Often says "The cards have spoken" and "Fate is not kind to those who ignore its whispers."',
    },
    {
      id: 'npc-van-richten',
      name: 'Rictavio (Van Richten)',
      description: 'A flamboyant carnival ringmaster who is secretly the legendary monster hunter Dr. Rudolph van Richten. Traveling with a saber-toothed tiger.',
      speechPatterns: 'As Rictavio: theatrical, bombastic, with exaggerated gestures. As Van Richten: grave, precise, knowledgeable. German accent.',
    },
    {
      id: 'npc-ezmerelda',
      name: 'Ezmerelda d\'Avenir',
      description: 'A young Vistani vampire hunter and former student of Van Richten. Has a prosthetic leg. Skilled with weapons and monster lore.',
      speechPatterns: 'Confident and direct. Slight Vistani accent. Sometimes hot-headed. Uses hunting terminology.',
    },
  ];

  for (const npc of npcs) {
    await prisma.nPC.upsert({
      where: { id: npc.id },
      update: npc,
      create: {
        ...npc,
        campaignId: campaign.id,
      },
    });
  }
  console.log(`✓ ${npcs.length} NPCs created`);

  // Create sound mappings
  const soundMappings = [
    {
      id: 'sound-combat',
      name: 'Combat Music',
      triggerType: 'keyword' as const,
      triggerValue: 'roll (for )?initiative|combat begins|attack',
      audioFile: 'combat/epic-battle.mp3',
      volume: 70,
      loop: true,
    },
    {
      id: 'sound-strahd',
      name: 'Strahd\'s Theme',
      triggerType: 'keyword' as const,
      triggerValue: 'strahd (appears|enters|arrives)|the count',
      audioFile: 'dramatic/revelation.mp3',
      volume: 80,
      loop: false,
    },
    {
      id: 'sound-tavern',
      name: 'Tavern Ambiance',
      triggerType: 'scene' as const,
      triggerValue: 'tavern',
      audioFile: 'tavern/cozy-inn.mp3',
      volume: 50,
      loop: true,
    },
    {
      id: 'sound-forest',
      name: 'Dark Forest',
      triggerType: 'scene' as const,
      triggerValue: 'forest',
      audioFile: 'forest/dark-forest.mp3',
      volume: 60,
      loop: true,
    },
    {
      id: 'sound-dungeon',
      name: 'Castle Ravenloft',
      triggerType: 'scene' as const,
      triggerValue: 'dungeon',
      audioFile: 'dungeon/ancient-crypt.mp3',
      volume: 60,
      loop: true,
    },
    {
      id: 'sound-tension',
      name: 'Suspense',
      triggerType: 'manual' as const,
      triggerValue: 'tension',
      audioFile: 'tense/growing-dread.mp3',
      volume: 65,
      loop: true,
    },
    {
      id: 'sound-victory',
      name: 'Victory!',
      triggerType: 'manual' as const,
      triggerValue: 'victory',
      audioFile: 'dramatic/victory-fanfare.mp3',
      volume: 80,
      loop: false,
    },
    {
      id: 'sound-death',
      name: 'Character Death',
      triggerType: 'manual' as const,
      triggerValue: 'death',
      audioFile: 'dramatic/tragedy.mp3',
      volume: 70,
      loop: false,
    },
  ];

  for (const mapping of soundMappings) {
    await prisma.soundMapping.upsert({
      where: { id: mapping.id },
      update: mapping,
      create: {
        ...mapping,
        campaignId: campaign.id,
      },
    });
  }
  console.log(`✓ ${soundMappings.length} sound mappings created`);

  // Create a sample session
  const session = await prisma.session.upsert({
    where: { id: 'session-1-death-house' },
    update: {},
    create: {
      id: 'session-1-death-house',
      campaignId: campaign.id,
      sessionNumber: 1,
      title: 'Death House',
      date: new Date('2024-01-15'),
      status: 'completed',
      transcript: [
        {
          id: 'seg-1',
          timestamp: 0,
          speakerLabel: 'Speaker 0',
          speakerName: 'DM',
          text: 'Welcome back everyone to Curse of Strahd. Last time, you found yourselves pulled through the mysterious mists into the dark land of Barovia.',
          confidence: 0.95,
          isEdited: false,
        },
        {
          id: 'seg-2',
          timestamp: 15000,
          speakerLabel: 'Speaker 1',
          speakerName: 'Sarah',
          text: 'Elara looks around nervously, clutching her holy symbol. "This place feels... wrong. Lathander\'s light seems dimmer here."',
          confidence: 0.92,
          isEdited: false,
        },
        {
          id: 'seg-3',
          timestamp: 28000,
          speakerLabel: 'Speaker 2',
          speakerName: 'Mike',
          text: 'Thorgrim grunts and hefts his warhammer. "Bah! Dark magic or not, nothing stands against dwarven steel."',
          confidence: 0.94,
          isEdited: false,
        },
      ],
      notes: 'Party explored Death House. Rose and Thorn ghosts encountered. Shambling mound in the basement nearly killed Zephyr.',
      recap: 'Previously on Curse of Strahd: Our heroes found themselves drawn through supernatural mists into the dread realm of Barovia. Following two ghostly children, Rose and Thorn, they entered a seemingly abandoned townhouse that proved to be far more sinister than it appeared. Descending into the depths beneath the house, they discovered a cult\'s sacrificial chamber and faced a horrifying shambling mound. Though Zephyr fell in battle, Elara\'s divine magic brought them back from the brink of death. Escaping the crumbling house, the party now stands in the village of Barovia, the dark silhouette of Castle Ravenloft looming in the distance...',
    },
  });
  console.log('✓ Sample session created:', session.title);

  // Create a draft session for testing live features
  const draftSession = await prisma.session.upsert({
    where: { id: 'session-2-village' },
    update: {},
    create: {
      id: 'session-2-village',
      campaignId: campaign.id,
      sessionNumber: 2,
      title: 'The Village of Barovia',
      date: new Date(),
      status: 'draft',
      transcript: [],
      notes: null,
      recap: null,
    },
  });
  console.log('✓ Draft session created:', draftSession.title);

  console.log('\n✅ Test data seeding complete!');
  console.log('\n📋 Summary:');
  console.log(`   Campaign: ${campaign.name}`);
  console.log(`   Players: ${players.map(p => p.characterName).join(', ')}`);
  console.log(`   NPCs: ${npcs.map(n => n.name).join(', ')}`);
  console.log(`   Sessions: ${session.title}, ${draftSession.title}`);
  console.log('\n🔗 Access the campaign at: http://localhost:5173/app/campaigns/test-campaign-curse-of-strahd');
}

seedTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



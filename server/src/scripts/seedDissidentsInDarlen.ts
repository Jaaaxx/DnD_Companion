import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDissidentsInDarlen() {
  console.log('🐉 Seeding "Dissidents in Darlen" campaign...\n');

  // Create or find user
  const testUser = await prisma.user.upsert({
    where: { clerkId: 'user_37woq4gAbfe2lRPIwgdNDVktXws' },
    update: {},
    create: {
      clerkId: 'user_37woq4gAbfe2lRPIwgdNDVktXws',
      email: 'jax@dndcompanion.app',
      name: 'Dungeon Master',
    },
  });
  console.log('✓ User created/found:', testUser.email);

  // Create the Dissidents in Darlen campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: 'campaign-dissidents-in-darlen' },
    update: {},
    create: {
      id: 'campaign-dissidents-in-darlen',
      name: 'Dissidents in Darlen',
      description: 'A political intrigue campaign set in the fledgling Arkosian Republic. Think Dungeons & Dragons meets the Weimar Republic. The players must stop paramilitary groups threatening the new democracy before a critical peace conference.',
      worldContext: `Setting: The Arkosian Republic - A fledgling democracy formed after the peaceful overthrow of the Arkosian Empire. The emperor has been exiled to an island with his mini-drake.

Capital City: Darlen - A city torn by street violence between competing paramilitary factions. Notable landmarks include the Council Chambers (former imperial palace) and a large imperial monument depicting a dragonborn emperor standing atop other races (scheduled for demolition).

Political Situation:
- Leader: Bular Apala, "The Sleeping Dragon" - Head of the new republic
- The 100+ year war with the Tiefling Empire of Baal-Tareth has ended
- Peace conference at Versailles-Carnot is upcoming - harsh terms expected if order isn't restored
- Rampant inflation: 8,000 Arkosian Republic gold pieces = ~800 actual gold (10:1 ratio)

Paramilitary Threats (3 days until planned coup):

1. THE FREE COMPANY (Most Dangerous)
   - Ex-soldiers from disbanded regiments, upset about seeking peace with Tieflings
   - Leaders: General Gul Cop (Gulkap) and Lieutenant Anadro Feierdrich
   - Believe they were "stabbed in the back" when victory was near
   - Planning violent overthrow to execute Bular and Snazelmann
   - Location: Unknown, intelligence suggests strike in 3 days

2. KPD (Kobolds for Parity with Dragonborn)
   - Proletarian kobolds seeking revenge against former oppressors
   - Leader: Kodraktis (potential ally against Free Company)
   - Attacking wealthy industrialists
   - Want accelerated social change, not patient with democratic process

3. NAGASKULLS (NS)
   - Fringe racial supremacist group (dragonborn/lizardfolk)
   - Leader: Aedrop the Black (unusual-looking dragonborn with "off" scales)
   - Wear brown uniforms, easy to identify
   - Target non-dragonborn citizens for beatings and murders
   - Want to establish a "racial reptilian state"
   - Currently smaller threat but growing

Flag of the Republic: Similar to German tricolor, featuring a dragon blowing a brass horn (possibly a sackbut)

Themes: Political intrigue, revolution, democracy vs. authoritarianism, class struggle, ethnic tensions, post-war instability
Tone: Serious political drama with moments of dark humor, historical allegory

Starting Equipment Provided by Bular:
- 4 Potions of Healing (shared)
- 2 Sets of Manacles
- 1 Jar of Acid
- 1 Smoke Bomb
- 2 Jugs of Alchemist's Fire

Reward: 8,000 Arkosian Republic gold pieces per person (worth ~800gp each due to inflation)

Key Locations in Darlen:
- Town Hall / Council Chambers (former imperial palace)
- The Citadel (military base on outskirts, where General Siegt is stationed)
- The Gear District (industrial area, Krupp's domain)
- Central Square (imperial monument, site of street violence)`,
      userId: testUser.id,
    },
  });
  console.log('✓ Campaign created:', campaign.name);

  // Create players
  const players = [
    {
      id: 'darlen-player-tyvia',
      playerName: 'Ian',
      characterName: 'Tyvia of the Southern Wilds',
      characterClass: 'Warlock',
      characterRace: 'Centaur',
      maxHp: 32,
      currentHp: 32,
      notes: 'Outlander background. Good at navigation and geography. Carries the party\'s map of Darlen and healing potions. "There is only Blackleaf" - deeply committed to roleplay.',
    },
    {
      id: 'darlen-player-byron',
      playerName: 'Russ',
      characterName: 'Byron',
      characterClass: 'Ranger',
      characterRace: 'Arakocra',
      maxHp: 42,
      currentHp: 42,
      notes: 'Outlander background. "Lord Byron" - the birdman. Raised by eagles. Good at intimidation from high vantage points. Uses custom monster race rules. First to engage the Nagaskulls by leaping onto the imperial monument.',
    },
    {
      id: 'darlen-player-dryad',
      playerName: 'Jason',
      characterName: 'Oaken',
      characterClass: 'Druid',
      characterRace: 'Dryad',
      maxHp: 35,
      currentHp: 35,
      notes: 'Custom monster race (homebrew). "I am Groot" energy. More graceful than the centaur, according to Bular. Cast Entangle on Nagaskulls to stop the beating of a Kenku.',
    },
    {
      id: 'darlen-player-sora',
      playerName: 'Renee',
      characterName: 'Maestan Sora',
      characterClass: 'Barbarian',
      characterRace: 'Dragonborn',
      maxHp: 52,
      currentHp: 52,
      notes: 'Goes by "Sora" (first name). Carries alchemist\'s fire. Trusted by Bular. Was confronted by Aedrop the Black for associating with "inferior races" - responded by throwing a javelin. Flaw: believes violence solves problems.',
    },
    {
      id: 'darlen-player-kasim',
      playerName: 'Bill',
      characterName: 'Kasim',
      characterClass: 'Monk',
      characterRace: 'Human',
      maxHp: 38,
      currentHp: 38,
      notes: 'From the Monastery of Infiltration Specialists (there\'s an initiation fee to join). Given the jar of acid and smoke bomb. "Shady-looking" according to Bular. Skilled at stealth and breaking line of sight.',
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
      id: 'darlen-npc-bular',
      name: 'Bular Apala, The Sleeping Dragon',
      description: 'Leader of the Arkosian Republic. A pragmatic dragonborn who led the peaceful overthrow of the emperor. Desperate to establish law and order before the peace conference at Versailles-Carnot. Has a contentious history with General Siegt.',
      speechPatterns: 'Speaks with diplomatic gravitas. Uses formal address. Prone to dry political commentary. Says things like "I would prefer violence not be used, but unfortunately violence is already being used." Refers to his associates with measured trust.',
    },
    {
      id: 'darlen-npc-snazelmann',
      name: 'Chancellor Snazelmann',
      description: 'Minister of Foreign Affairs and Bular\'s most trusted associate. Organizing the peace conference at Versailles-Carnot. Senses the conference will not go well - harsh terms expected if the Republic can\'t demonstrate stability.',
      speechPatterns: 'Formal diplomatic speech. Likely has an advanced degree (doctorate). Name is a "brand that people respect."',
    },
    {
      id: 'darlen-npc-siegt',
      name: 'General Siegt',
      description: 'Commander of the Republic\'s armed forces, chief by seniority. Based at the Citadel on the outskirts of Darlen. Has a long, complicated history with Bular and doesn\'t always follow orders.',
      speechPatterns: 'Military bearing. Probably curt and formal. May be resentful of civilian leadership.',
    },
    {
      id: 'darlen-npc-krupp',
      name: 'Magister Krupp',
      description: 'Chief industrialist in Darlen. Manufactured most of the munitions and weaponry during the war with the Tieflings. Located in the Gear District. Hires heavy security due to KPD threats against wealthy industrialists.',
      speechPatterns: 'Business-minded. Pragmatic. Probably speaks in terms of resources, production, and security.',
    },
    {
      id: 'darlen-npc-kodraktis',
      name: 'Kodraktis',
      description: 'Leader of the KPD (Kobolds for Parity with Dragonborn). Represents the proletarian kobolds who were oppressed under the empire. Not a fan of Gul Cop because Cop is an aristocrat. Potential ally against the Free Company despite Bular disapproving of KPD methods.',
      speechPatterns: 'Revolutionary fervor. Speaks of class struggle and revenge against oppressors. Probably passionate and idealistic.',
    },
    {
      id: 'darlen-npc-aedrop',
      name: 'Aedrop the Black',
      description: 'Leader of the Nagaskulls. An unusual-looking dragonborn with scales that are "a little off." Wears brown uniform. Leads a fringe racial supremacist group of dragonborn and lizardfolk. Targets non-dragonborn citizens.',
      speechPatterns: 'Supremacist rhetoric. Yells at crowds. Calls non-dragonborn "inferior races." Confrontational. Challenges other dragonborn for associating with other races.',
    },
    {
      id: 'darlen-npc-gulcop',
      name: 'General Gul Cop (Gulkap)',
      description: 'Former war general and aristocrat. Leader of the Free Company. Believes the Republic "stabbed the army in the back" by seeking peace when victory was near. Planning to violently overthrow the government and execute Bular and Snazelmann. ARREST ON SIGHT.',
      speechPatterns: 'Military commander. Probably speaks of betrayal, honor, and stolen victory. Noble bearing mixed with bitter resentment.',
    },
    {
      id: 'darlen-npc-feierdrich',
      name: 'Anadro Feierdrich',
      description: 'Second-in-command of the Free Company under Gul Cop. Former military officer. ARREST ON SIGHT.',
      speechPatterns: 'Military subordinate. Loyal to Cop. Probably echoes Free Company rhetoric about betrayal.',
    },
    {
      id: 'darlen-npc-kenku-victim',
      name: 'Unnamed Kenku',
      description: 'A Kenku (raven-like birdfolk) who was being beaten by Nagaskull members in the central square. Currently restrained by magical vines along with his attackers. Kenkus are generally disliked and marginalized in most communities.',
      speechPatterns: 'Kenkus can only mimic sounds they\'ve heard. Speaks in borrowed phrases and sound effects.',
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

  // Create sound mappings appropriate for this political thriller campaign
  const soundMappings = [
    {
      id: 'darlen-sound-combat',
      name: 'Street Combat',
      triggerType: 'keyword' as const,
      triggerValue: 'roll (for )?initiative|combat begins|attack|javelin',
      audioFile: 'combat/epic-battle.mp3',
      volume: 70,
      loop: true,
    },
    {
      id: 'darlen-sound-bular',
      name: 'Bular\'s Office',
      triggerType: 'keyword' as const,
      triggerValue: 'bular|sleeping dragon|council chambers',
      audioFile: 'social/council-meeting.mp3',
      volume: 50,
      loop: true,
    },
    {
      id: 'darlen-sound-tension',
      name: 'Political Tension',
      triggerType: 'keyword' as const,
      triggerValue: 'free company|gul cop|gulkap|overthrow|coup',
      audioFile: 'tense/growing-dread.mp3',
      volume: 65,
      loop: true,
    },
    {
      id: 'darlen-sound-nagaskulls',
      name: 'Nagaskull Encounter',
      triggerType: 'keyword' as const,
      triggerValue: 'nagaskull|brown uniform|aedrop|inferior races',
      audioFile: 'tense/dark-approach.mp3',
      volume: 70,
      loop: false,
    },
    {
      id: 'darlen-sound-city',
      name: 'City of Darlen',
      triggerType: 'scene' as const,
      triggerValue: 'exploration',
      audioFile: 'ambient/city-ambiance.mp3',
      volume: 45,
      loop: true,
    },
    {
      id: 'darlen-sound-square',
      name: 'Central Square',
      triggerType: 'keyword' as const,
      triggerValue: 'central square|monument|statue|crowd',
      audioFile: 'social/market-bustle.mp3',
      volume: 50,
      loop: true,
    },
    {
      id: 'darlen-sound-industrial',
      name: 'Gear District',
      triggerType: 'keyword' as const,
      triggerValue: 'gear district|krupp|factory|industrial',
      audioFile: 'ambient/forge-workshop.mp3',
      volume: 55,
      loop: true,
    },
    {
      id: 'darlen-sound-military',
      name: 'The Citadel',
      triggerType: 'keyword' as const,
      triggerValue: 'citadel|siegt|military|army|soldiers',
      audioFile: 'dramatic/march.mp3',
      volume: 60,
      loop: true,
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

  // Create the first session (intro/briefing)
  const session1 = await prisma.session.upsert({
    where: { id: 'darlen-session-1-briefing' },
    update: {},
    create: {
      id: 'darlen-session-1-briefing',
      campaignId: campaign.id,
      sessionNumber: 1,
      title: 'The Briefing',
      date: new Date(),
      status: 'in_progress',
      transcript: [
        {
          id: 'darlen-seg-1',
          timestamp: 0,
          speakerLabel: 'Speaker 0',
          speakerName: 'DM (Sean)',
          text: 'So, the title of this is Dissidents in Darlen. For a shorthand, this is essentially Dungeons & Dragons in the Weimar Republic.',
          confidence: 0.95,
          isEdited: false,
        },
        {
          id: 'darlen-seg-2',
          timestamp: 15000,
          speakerLabel: 'Speaker 0',
          speakerName: 'DM (Sean)',
          text: 'The setting for our players is essentially the Arkosian Empire has recently been toppled by a peaceful overthrow of the imperial government. The emperor has been exiled, and a new republican form of government known as the Arkosian Republic has been founded with its leader, Bular Apala, the Sleeping Dragon, at its head.',
          confidence: 0.94,
          isEdited: false,
        },
        {
          id: 'darlen-seg-3',
          timestamp: 45000,
          speakerLabel: 'Speaker 0',
          speakerName: 'Bular Apala',
          text: 'Welcome, welcome, welcome. I\'m glad you all could make it here today. There is a great threat to the fledgling republic from a certain paramilitary group under the leadership of one of our former generals, Gul Cop.',
          confidence: 0.93,
          isEdited: false,
        },
        {
          id: 'darlen-seg-4',
          timestamp: 75000,
          speakerLabel: 'Speaker 0',
          speakerName: 'Bular Apala',
          text: 'Three days from now is when the intended strike is going to occur. It is your job to hopefully find him and arrest him and his second-in-command, Anadro Feierdrich. Preferably, I would like to see these gentlemen stand trial, so please do not kill them if you can help it.',
          confidence: 0.94,
          isEdited: false,
        },
        {
          id: 'darlen-seg-5',
          timestamp: 120000,
          speakerLabel: 'Speaker 0',
          speakerName: 'DM (Sean)',
          text: 'In the central square, you see three lizardfolk and one dragonborn in brown robes. They\'re engaged in beating up a Kenku. The dragonborn looks over and sees your group. He singles in on Sora and says: "What are you doing with these inferior races?"',
          confidence: 0.92,
          isEdited: false,
        },
        {
          id: 'darlen-seg-6',
          timestamp: 150000,
          speakerLabel: 'Speaker 1',
          speakerName: 'Russ (Byron)',
          text: 'I\'m going to jump on top of the statue, take my bow out, and tell them they best run along, or I\'ll have some new target practice.',
          confidence: 0.91,
          isEdited: false,
        },
        {
          id: 'darlen-seg-7',
          timestamp: 165000,
          speakerLabel: 'Speaker 2',
          speakerName: 'Ian (Tyvia)',
          text: 'I cast Entangle. Before we start shooting them - he asked us to be non-violent.',
          confidence: 0.93,
          isEdited: false,
        },
        {
          id: 'darlen-seg-8',
          timestamp: 180000,
          speakerLabel: 'Speaker 3',
          speakerName: 'Renee (Sora)',
          text: 'Enough talk! I throw a javelin at the acolyte. I feel that he is bringing dishonor on me and my kind.',
          confidence: 0.92,
          isEdited: false,
        },
      ],
      notes: `Session 1 - The party received their mission briefing from Bular Apala at Town Hall.

Key Information Learned:
- Three paramilitary groups: Free Company (most dangerous), KPD, Nagaskulls
- Free Company planning coup in 3 days
- Must arrest Gul Cop and Anadro Feierdrich (preferably alive)
- Reward: 8,000 ARgp per person (~800gp actual value)

Contacts Given:
- Kodraktis (KPD) - potential ally
- General Siegt (Citadel) - military support
- Magister Krupp (Gear District) - equipment/security

Equipment Received:
- 4 potions of healing, 2 manacles, 1 jar acid, 1 smoke bomb, 2 alchemist's fire

First Encounter:
- Nagaskulls (Aedrop the Black + 3 lizardfolk) beating a Kenku in central square
- Tyvia cast Entangle to restrain them (including the Kenku)
- Sora threw javelin at Aedrop (hit!)
- Combat initiated`,
      recap: null,
    },
  });
  console.log('✓ Session 1 created:', session1.title);

  console.log('\n✅ "Dissidents in Darlen" campaign seeded successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Campaign: ${campaign.name}`);
  console.log(`   Setting: Weimar Republic-inspired political thriller`);
  console.log(`   Players: ${players.map(p => `${p.characterName} (${p.characterRace} ${p.characterClass})`).join(', ')}`);
  console.log(`   Key NPCs: Bular Apala, Gul Cop, Aedrop the Black, Kodraktis, Krupp, Siegt`);
  console.log(`   Threat Level: 3 days until Free Company coup attempt`);
  console.log('\n🔗 Access the campaign at: http://localhost:5173/app/campaigns/campaign-dissidents-in-darlen');
}

seedDissidentsInDarlen()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Your actual Clerk user ID
const CLERK_USER_ID = 'user_37woq4gAbfe2lRPIwgdNDVktXws';
// Your actual email from Clerk (update this to match your Clerk account)
const USER_EMAIL = 'jax.hutton@comcast.net';
const USER_NAME = 'Jax';

async function syncUserAndCampaign() {
  console.log('🔄 Syncing user and campaign data...\n');

  // Step 1: Delete any existing users that might conflict
  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkId: CLERK_USER_ID },
  });
  
  const existingByEmail = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
  });

  console.log('Existing user by clerkId:', existingByClerkId?.id || 'none');
  console.log('Existing user by email:', existingByEmail?.id || 'none');

  // If there are two different users (one by email, one by clerkId), we need to merge
  if (existingByEmail && existingByClerkId && existingByEmail.id !== existingByClerkId.id) {
    console.log('\n⚠️  Found conflicting users! Merging...');
    
    // Move all campaigns from the email user to the clerkId user
    await prisma.campaign.updateMany({
      where: { userId: existingByEmail.id },
      data: { userId: existingByClerkId.id },
    });
    
    // Delete the email user
    await prisma.user.delete({
      where: { id: existingByEmail.id },
    });
    
    console.log('✓ Merged users');
  }

  // Step 2: Upsert the user with correct data
  const user = await prisma.user.upsert({
    where: { clerkId: CLERK_USER_ID },
    update: {
      email: USER_EMAIL,
      name: USER_NAME,
    },
    create: {
      clerkId: CLERK_USER_ID,
      email: USER_EMAIL,
      name: USER_NAME,
    },
  });

  console.log(`\n✓ User synced: ${user.email} (${user.id})`);
  console.log(`  Clerk ID: ${user.clerkId}`);

  // Step 3: Check if campaign exists
  let campaign = await prisma.campaign.findUnique({
    where: { id: 'campaign-dissidents-in-darlen' },
  });

  if (campaign) {
    // Update campaign ownership if needed
    if (campaign.userId !== user.id) {
      campaign = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { userId: user.id },
      });
      console.log(`\n✓ Campaign ownership updated to ${user.email}`);
    } else {
      console.log(`\n✓ Campaign already owned by ${user.email}`);
    }
  } else {
    console.log('\n⚠️  Campaign not found. Run the seed script first:');
    console.log('   npx tsx src/scripts/seedDissidentsInDarlen.ts');
  }

  // Step 4: Show final state
  const finalCampaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
  });

  console.log(`\n📋 Campaigns owned by ${user.email}:`);
  for (const c of finalCampaigns) {
    console.log(`   - ${c.name} (${c.id})`);
  }

  // List all users for debugging
  const allUsers = await prisma.user.findMany({
    select: { id: true, clerkId: true, email: true },
  });
  
  console.log('\n👥 All users in database:');
  for (const u of allUsers) {
    console.log(`   - ${u.email} | clerkId: ${u.clerkId} | id: ${u.id}`);
  }

  console.log('\n✅ Sync complete!');
}

syncUserAndCampaign()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


import { Link } from 'react-router-dom';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { 
  Mic, 
  Music, 
  Heart, 
  BookOpen, 
  Swords,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pattern-grid opacity-50" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-mystic-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-dragon-600/10 rounded-full blur-3xl" />
        
        {/* Navigation */}
        <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-mystic-600 flex items-center justify-center">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <span className="font-display text-xl font-semibold">D&D Companion</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Show different nav based on auth state */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn-ghost">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn-primary">Get Started</button>
              </SignUpButton>
            </SignedOut>
            
            <SignedIn>
              <Link to="/app" className="btn-primary flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  }
                }}
              />
            </SignedIn>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mystic-900/50 border border-mystic-700/50 mb-8">
            <Sparkles className="w-4 h-4 text-mystic-400" />
            <span className="text-sm text-mystic-300">AI-Powered Campaign Management</span>
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Your Campaign,</span>
            <br />
            <span className="text-parchment-100">Amplified</span>
          </h1>
          
          <p className="text-xl text-dungeon-300 max-w-2xl mx-auto mb-12">
            Real-time transcription, automatic sound effects, health tracking, and AI-powered 
            session recaps. Focus on the story while your companion handles the rest.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Show different CTA based on auth state */}
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="btn-primary text-lg px-8 py-4 flex items-center gap-2">
                  Start Your Adventure
                  <ArrowRight className="w-5 h-5" />
                </button>
              </SignUpButton>
            </SignedOut>
            
            <SignedIn>
              <Link to="/app" className="btn-primary text-lg px-8 py-4 flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </SignedIn>
            
            <a href="#features" className="btn-secondary text-lg px-8 py-4">
              See Features
            </a>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold mb-4">
              Everything You Need to Run Epic Sessions
            </h2>
            <p className="text-dungeon-300 text-lg max-w-2xl mx-auto">
              From real-time transcription to automated atmosphere, every feature 
              is designed to keep you immersed in the story.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <Mic className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Real-Time Transcription
                </h3>
                <p className="text-dungeon-300">
                  Automatic speech-to-text with AI-powered speaker identification. 
                  Know who said what, even when the DM plays multiple characters.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <Music className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Automated Atmosphere
                </h3>
                <p className="text-dungeon-300">
                  Sound effects and music that react to your session. Combat drums 
                  when initiative is rolled, tavern ambiance during downtime.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <Heart className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Smart Health Tracking
                </h3>
                <p className="text-dungeon-300">
                  AI detects damage and healing from dialogue. Get notifications 
                  to confirm changes, keeping combat smooth and accurate.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <BookOpen className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Session Recaps
                </h3>
                <p className="text-dungeon-300">
                  AI-generated "Previously on..." summaries. Perfect for starting 
                  sessions or catching up absent players.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <Swords className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Campaign Management
                </h3>
                <p className="text-dungeon-300">
                  Organize campaigns, track sessions, manage players and NPCs. 
                  Everything in one place for quick reference.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="card group hover:border-mystic-500/50 transition-colors">
              <div className="card-body">
                <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center mb-4 group-hover:bg-mystic-600/30 transition-colors">
                  <Sparkles className="w-6 h-6 text-mystic-400" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Context-Aware AI
                </h3>
                <p className="text-dungeon-300">
                  The more you tell it about your world, the smarter it gets. 
                  NPCs, locations, and lore all inform the AI's understanding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-mystic-900/10 to-transparent" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="font-display text-4xl font-bold mb-4">
            Ready to Level Up Your Sessions?
          </h2>
          <p className="text-dungeon-300 text-lg mb-8 max-w-xl mx-auto">
            Join DMs who are creating more immersive, memorable campaigns with less prep work.
          </p>
          
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="btn-primary text-lg px-8 py-4">
                Get Started Free
              </button>
            </SignUpButton>
          </SignedOut>
          
          <SignedIn>
            <Link to="/app" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dungeon-800 py-12">
        <div className="container mx-auto px-6 text-center text-dungeon-400">
          <p>© 2024 D&D Companion. Not affiliated with Wizards of the Coast.</p>
        </div>
      </footer>
    </div>
  );
}

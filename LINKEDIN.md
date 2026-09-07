# LinkedIn: Rival Minds

Everything to paste into the "Add project" dialog. LinkedIn limits: project name 255,
project description 2,000, media title 200, media description 500.

---

## Project fields

### Project name*

```
Rival Minds - a live reinforcement learning tournament (13 RL algorithms, 5 arenas)
```

Shorter alternative:

```
Rival Minds - a live reinforcement learning tournament
```

### Description

```
Rival Minds is a reinforcement learning tournament you can watch. Two agents, Red and Blue, learn the same task head to head across five themed 3D arenas while the browser renders every episode live.

Each round pits a rival pair of algorithms from the Sutton and Barto progression against each other:
1. Peach's Castle - Value Iteration vs Policy Iteration (dynamic programming over a ~23,000 state stochastic MDP)
2. New Donk City - First-visit vs Every-visit Monte Carlo
3. Fossil Falls - SARSA vs Q-Learning (on-policy vs off-policy TD)
4. Ruined Kingdom - DQN vs Double-DQN vs Dueling-DQN (continuous 55-D state, function approximation)
5. Dry Dry Desert - Actor-Critic vs PPO vs REINFORCE (policy gradient, 66-D state, 10 actions)

The learning is real Python RL running in a background thread on Gymnasium environments; the browser is a live viewer that polls the match ~30 times a second over a small JSON API. A control panel exposes every hyperparameter live (alpha, gamma, the epsilon schedule, entropy, replay buffer, target sync) alongside V(s) heatmaps, a click-a-tile Q(s,a) inspector, learning curves and a replay browser of each model's best episodes. You can also take the controls and play Blue yourself against the CPU.

I ran measured sweeps for every round instead of guessing, scoring full tournament matches across multiple world seeds. Two results that made the theory concrete: in Round 3, Q-Learning and SARSA at identical hyperparameters split 98% / 2%, because off-policy learns the optimal policy while on-policy learns its own epsilon-tainted one. In Round 5, dropping PPO's entropy bonus from 0.01 to 0.003 moved it from 57% to 90% and held the opponent to zero wins.

~12k lines of Python across 52 modules and ~22k lines of JavaScript, with no build step: three.js is vendored and one stdlib HTTP server hosts the game, trains the models and serves the API.
```

### Skills (top 5)

1. Reinforcement Learning
2. Python (Programming Language)
3. PyTorch
4. Deep Learning
5. Three.js (swap for JavaScript if you want the profile to read AI-first)

### Dates

- Start: **June 2026**
- End: **July 2026**
- "Currently working on this": leave unchecked (tick it and clear the end date if the defense is still ahead)

### Contributors

Leave empty if solo.

### Associated with

Your education entry for this degree.

---

## Media

Recommended order. The first item becomes the thumbnail on your profile.

If you want to trim, the ten that carry the project on their own are marked **[core]**.

---

### 1. Start menu **[core]**

**Title**

```
Rival Minds: the start menu
```

**Description**

```
The whole project in one screen: pick your character, pick your algorithm, then watch two models train head to head across five rounds. There is no package manager and no build step anywhere in it. three.js is vendored, and a single Python standard library server hosts the page, runs the training thread and serves the JSON API the browser polls.
```

---

### 2. Round 1, Peach's Castle **[core]**

**Title**

```
Round 1: Value Iteration vs Policy Iteration in Peach's Castle
```

**Description**

```
The dynamic programming round: the model is known, so both sides plan with the Bellman equations instead of learning from experience. State is (tile, collected mask, power-up status), about 23,000 values, in a genuinely stochastic MDP where ice tiles deflect a move 30% of the time and Mystery Blocks roll a random ghost or freeze. Both planners converge to the same optimal policy, so the whole race is who gets a usable one first, measured in Bellman sweeps per tick.
```

---

### 3. Round 2, New Donk City **[core]**

**Title**

```
Round 2: Monte Carlo control in a New Donk City park
```

**Description**

```
The Monte Carlo round: no bootstrapping, so nothing is learned until an episode ends and the full return comes back. Collect your 3 tomatoes, then reach the goal. State is (tile, 3-bit collected mask), about 2,100 values, and the mask is what keeps it Markov, since the best route depends on what you still need. Piranha plants end the episode, puddles cause a skid. Both sides run First-visit MC here, so only the hyperparameters differ.
```

---

### 4. Round 3, Fossil Falls **[core]**

**Title**

```
Round 3: Q-Learning in a randomly generated 19x19 maze
```

**Description**

```
The temporal-difference round: no model of the world, so both agents learn Q online from one-step updates. The board is a randomly generated 19x19 perfect maze, fixed for the round so it can actually be learned. State is (tile, Goomba patrol phase, rival flag, door flag), roughly 9,800 values, with 5 actions including stay to wait out a Goomba. Puddles cause a skid. Both sides run Q-Learning here, so the only difference between them is the hyperparameters.
```

---

### 5. Round 4, Ruined Kingdom **[core]**

**Title**

```
Round 4: DQN vs Dueling-DQN, dodging Banzai Bills in a continuous arena
```

**Description**

```
The deep RL round: the state is continuous, so a neural network approximates Q instead of a lookup table. Mario runs DQN (blue) against the CPU's Dueling-DQN (red). Each reads a 55-value observation (own kinematics, effect timers, the 3 nearest Banzai Bills, the 3 nearest pickups) and picks one of 9 actions: 8 directions plus stay. Three hearts each, one lost per hit, last one standing wins. The top bars are live win rates, updating as both models train.
```

---

### 6. Round 5, Dry Dry Desert **[core]**

**Title**

```
Round 5: Actor-Critic vs PPO, capture the flag in Dry Dry Desert
```

**Description**

```
The policy gradient round: Mario runs Actor-Critic (blue) against the CPU's PPO (red). Both read a 66-value observation and pick from 10 actions (8 thrust directions, coast, and USE to fire a weapon). No epsilon here, since policy gradients explore by sampling from the policy itself. Grab the flag at the centre pole, carry it to your base, first to 3 captures wins. The top bars are live win rates, updating as both models train.
```

---

### 7. Control panel, every tab **[core]**

**Title**

```
The control panel: one dashboard, rebuilt per round and per algorithm
```

**Description**

```
Every tab of the control panel, side by side. It rebuilds itself for whichever round and algorithm family is running: a briefing generated from the live environment (the goal, the state vector, the exact reward table, items, hazards), sliders for both the agent's hyperparameters and the world's dynamics, diagnostics that swap between DQN internals and policy gradient ones, live learning curves, and a replay browser of the best episodes. All of it editable while training continues.
```

---

### 8. Control panel, Progress tab **[core]**

**Title**

```
Training telemetry: win rate, return, epsilon and episode length
```

**Description**

```
The progress tab is the honest view of a run: episode count, total steps, average course length, the last return for each side, and four live charts. This particular run is a losing one, blue at 18% against red's 49%, which is the point of showing it. Actor-Critic against a well tuned PPO opponent is exactly the matchup my Round 5 sweeps found PPO winning, and the chart is that result happening in real time.
```

---

### 9. Control panel, Inside tab **[core]**

**Title**

```
Policy gradient diagnostics: entropy, value loss and action mix
```

**Description**

```
A policy round has no replay buffer, no target network and no Q at all, so the DQN diagnostics are replaced by the numbers that do matter here: progress through the current rollout, updates so far, whether a critic is learning V(s), policy entropy as the exploration signal, and value loss. Red's entropy is collapsing as it commits to a policy while blue is still dithering, which is the whole story of the round in one chart.
```

---

### 10. Control panel, Tune tab **[core]**

**Title**

```
Every hyperparameter is live-editable during training
```

**Description**

```
The tune tab exposes the full DQN configuration while the model is running: learning rate, discount, the epsilon schedule, network width and depth, batch size, replay buffer, warmup steps, target sync interval and n-step returns. A change takes effect on the next update, so the effect of each knob is something you watch happen rather than read about.
```

---

### 11. Control panel, World tab **[core]**

**Title**

```
Tuning the environment, not just the agent
```

**Description**

```
The world tab separates algorithm internals (entropy bonus, GAE lambda, value loss weight, rollout horizon, PPO clip, epochs, minibatch) from the environment dynamics (cannonballs per volley, how often the airship fires, how fast objects travel, how far ahead an incoming one becomes visible). The random seed is a slider too, so any result can be reproduced exactly.
```

---

### 12. Control panel, Replays tab **[core]**

**Title**

```
Episode replay: the top 30 runs and the paths they traced
```

**Description**

```
Every completed run is recorded and ranked by return, and can be replayed with the policy, value and visit data frozen exactly as they were at that episode. The path plots underneath compare the two models directly: red has settled into a near straight line from spawn to base, while blue is still exploring alternatives around the same route.
```

---

### 13. Briefing, State tab **[core]**

**Title**

```
Briefing: the 66 numbers a policy network sees each step
```

**Description**

```
The state tab unpacks the observation vector group by group: self, opponent, the flag and who holds it, both bases, status, nearby crates, the held weapon, shells, traps and incoming objects. 66 numbers, refreshed every step, and each group expands to name its individual values. Being able to show exactly what the agent knows, and what it cannot see, is half of debugging an RL environment.
```

---

### 14. Briefing, Rewards tab

**Title**

```
Briefing: the full reward function, with nothing hidden
```

**Description**

```
Every reward and penalty in the round on one screen, from +1 for a capture down to the -0.002 per step cost that makes speed part of the objective. The footnote is the important part: only the listed rewards are used, with no hidden shaping term nudging the agent toward the goal. Behaviour like baiting and juking has to emerge from these numbers alone.
```

---

### 15. Briefing, Game tab

**Title**

```
The briefing card: every round explains its own MDP
```

**Description**

```
Each round opens with a briefing generated from the live environment rather than hardcoded text: the goal, how a round plays out, the action set, the slip chance, the step cap. Round 1 is the planning round, so the banner at the bottom reports the moment both planners have converged and are competing on fixed policies.
```

---

### 16. Briefing, Enemies tab

**Title**

```
Briefing: the hazards that make Round 3 stochastic
```

**Description**

```
The briefing also names the two sources of difficulty. Goombas patrol a fixed route, so touching one ends the episode and the agent has to learn to time its crossing. Wet cells can skid a move sideways, and that variance is what lets a race actually be lost. Without it, two converged tabular policies would produce the same race every time.
```

---

### 17. Briefing, Items tab

**Title**

```
Briefing: the item set that widens the action space
```

**Description**

```
Crates drop one of five weapons into a single inventory slot, fired with a tenth USE action. Adding them was a deliberate test rather than decoration: a wider action space whose last action is conditionally useless (USE does nothing while unarmed) is harder to learn, so I re-verified that both policy gradient methods still converge before shipping it.
```

---

### 18. Algorithms screen, family cards

**Title**

```
The five algorithm families, from planning to policy gradient
```

**Description**

```
The tournament follows the Sutton and Barto progression: dynamic programming, Monte Carlo, temporal difference, deep value based, policy gradient. Each card names what its family assumes (model known or model free, episodic or bootstrapping) and which algorithms sit inside it. One round per family, 13 algorithms in total, and any of them can be assigned to either side.
```

---

### 19. Algorithms screen, DQN family

**Title**

```
Algorithm cards: DQN, Double-DQN and Dueling-DQN
```

**Description**

```
Opening a family fans out its algorithms with the one line that actually distinguishes them: DQN is neural Q with experience replay and a target network, Double-DQN decouples the action pick from its value to cut overestimation, Dueling-DQN splits the head into state-value and advantage streams. In Round 4 the dueling head measured best, at a 66% win rate against the strongest CPU.
```

---

### 20. Character select

**Title**

```
Character select: the CPU's difficulty is a hyperparameter ladder
```

**Description**

```
Choosing the CPU's character chooses its hyperparameters. Each of the ten characters carries a profile tuned per round, so a weak one learns slowly, plans short-sighted and stays random forever, while the champion converges fast and plays near-optimally. The card on the right shows which algorithm it runs in each of the five rounds and how strong it is there.
```

---

### 21. How It Works

**Title**

```
The onboarding cards: how a tournament is scored
```

**Description**

```
A four card explainer in the start menu. Each round goes to whoever out-scores their rival (faster, safer, higher reward), and whoever takes the most rounds is champion. Writing these was a constraint of its own: the project is a teaching tool for a course, so every rule has to be legible to someone who has never seen an MDP.
```

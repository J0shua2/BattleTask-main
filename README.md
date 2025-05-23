﻿# BattleTask

A Chrome extension that "gamifies" staying focused while browsing by turning your focus time into monster battles. It uses AI to analyze your browser tabs and determine if they contain educational content.

## Core Features

- **Monster Battles**: Fight procrastination monsters with LASER FOCUS on educational content
- **AI-Powered Tab Analysis**: Uses Google's Gemini API to determine if tabs contain educational content
- **Focus Timer**: Set battle durations and track your progress
- **Health System**: Lose health every 15sec when browsing non-educational content
- **Monster Generation**: Battle up to 125 different randomly generated monsters!
- **Statistics Tracking**: Track battle wins and total focus minutes

## Tech Stack

- **Frontend**: HTML, JavaScript
- **Backend**: JavaScript
- **AI**: Google Gemini API

## Installation

1. Clone this repository
2. Install backend dependencies:
   ```
   npm install
   ```
3. Start the backend server:
   ```
   npm start
   ```
4. Make .env file and enter Google Gemeni API Key
   ```
   GEMINI_API_KEY = ENTER KEY
   ```
5. Load the extension in Chrome:
   - Go to chrome://extensions/
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this project directory

## How It Works

1. When you start a battle, a random monster is generated
2. As you browse, tab titles are analyzed by the Gemini API
3. Educational tabs help you win the battle
4. Non-educational tabs cause you to lose health
5. Win by surviving until the timer runs out
6. Lose if your health reaches zero

## Monster Generation

Monsters are composed of three parts:
- Body (5 variations)
- Eyes (5 variations)
- Limbs (5 variations)

This creates 125 possible unique monster combinations!

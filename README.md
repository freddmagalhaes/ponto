# Ponto - Employee Time Tracking System

A comprehensive web-based employee time tracking system built with React, Supabase, and Tailwind CSS.

## Features
- User authentication
- Administrative dashboard
- Employee and record management
- Automated work hours, overtime, and night shift calculations
- AFV file import

## Mock Credentials (Testing)
To test the interface without a real Supabase backend or to access the existing mock users, you can use the following mock credentials:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@teste.com` | `123456` |
| Regular User | `user@teste.com` | `123456` |

These credentials will mock a successful login flow and set up local state for testing purposes, allowing you to view the Dashboard and other pages.

## Setup

1. Configure `.env`: Use the provided `.env.example` file to configure your Supabase URL and Anon Key. Or skip this step if you just want to test using the mock credentials above without setting up the backend yet.
2. Install dependencies: `npm install`
3. Run locally: `npm run dev`

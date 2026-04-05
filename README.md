PocketSense — Personal Finance Tracker

A full-stack personal finance web application with real-time Firebase synchronization, role-based access control, analytics, and a responsive dark/light user interface. Built using HTML, CSS, and JavaScript.

Live Demo: https://pocket-sense.netlify.app

Demo Credentials

Role: User
Email: demo@pocketsense.app
Password: demo1234

Role: Admin
Email: admin@pocketsense.app
Password: admin1234

to access the admin panel the admin should click the logo 3 times to redirect it to the admin panel.

Overview

PocketSense helps users manage personal finances efficiently while providing administrators with platform-level insights and controls. The application supports both online (Firebase-powered) and offline (localStorage-based) modes.


Features

Dashboard Overview

Displays key financial metrics: Balance, Total Income, Total Expenses, and Savings Rate
Includes animated counters, sparklines, and contextual insights

Time-Based Visualization

Line chart showing balance trends over selectable periods (1, 3, or 6 months)
Adapts to dark and light themes

Spending Breakdown

Doughnut chart for expense categories
Category breakdown table with visual indicators

Transaction Management

Detailed transaction list with category, description, date, type, and amount
Supports editing and deletion
Recent transactions preview on dashboard

Filtering and Sorting

Real-time search
Filter by type and category
Sort by date and amount

Role-Based Access

User Dashboard

Manage personal transactions
View analytics and insights

Admin Portal

Manage users and transactions
View platform analytics
Export transaction data
Perform administrative actions

Insights Module

Top spending category
Monthly activity analysis
Average daily expenditure
Highest income transaction
Income vs expense comparison

State Management

Centralized state object for user data, transactions, filters, charts, and theme
Firebase Firestore for real-time sync
localStorage for offline mode

Responsive Design

Optimized for desktop, tablet, and mobile
Adaptive layouts and collapsible navigation
Theme switching support
Project Structure

pocketsense/
index.html User dashboard and authentication
styles.css UI styles
app.js Core logic
data.js Shared utilities
admin.html Admin interface
admin.css Admin styles

Technology Stack

Frontend: HTML5, CSS3, JavaScript
Charts: Chart.js
Backend: Firebase Authentication, Firestore
Storage: localStorage (offline mode)
Hosting: Netlify

Categories Supported

Food & Dining — Expense
Transport — Expense
Shopping — Expense
Utilities — Expense
Entertainment — Expense
Healthcare — Expense
Salary — Income
Freelance — Income
Investment — Both
Other — Both

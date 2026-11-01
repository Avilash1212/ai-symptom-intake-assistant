# AI Symptom Intake Assistant

An AI-powered symptom intake assistant designed to help patients communicate their symptoms and help doctors prepare for consultations through structured, AI-generated summaries.

## Overview

Collecting basic patient information can take up a significant portion of a doctor's consultation time. Patients often need to explain their symptoms, describe their duration and severity, and answer several routine questions before the actual consultation begins.

The AI Symptom Intake Assistant aims to streamline this process by collecting symptom information before the doctor consultation.

Patients interact with an AI assistant that asks standard questions and generates relevant follow-up questions based on their responses. Once the intake is complete, the application generates a structured symptom summary for the doctor to review.

**The product focuses on improving consultation preparation, not replacing medical professionals.**

## Problem Statement

- Doctors spend valuable consultation time collecting basic symptom information.
- Patients may forget or struggle to communicate important details about their symptoms.
- Information provided during consultations may not always be structured or easy to review.

## Solution

The application provides a structured AI-powered symptom intake workflow.

Patients describe their symptoms through text or voice, answer relevant questions, review the generated summary, and submit it for doctor review.

Doctors can log in to a dedicated dashboard and access submitted patient summaries before consultations.

## Key Features

### Patient Interface
- Separate patient entry point.
- Symptom description through text and voice input.
- Standard symptom-intake questions.
- AI-generated dynamic follow-up questions.
- Options such as "Not Applicable" and "Don't Know / Not Sure".
- AI-generated structured symptom summaries.
- Patient review and confirmation before submission.
- Like button and optional written feedback.

### Doctor Interface
- Dedicated doctor login.
- Secure doctor dashboard.
- List of submitted patient intakes.
- Individual patient symptom summaries.
- Access to original patient responses for clarification.

### AI Capabilities
- Context-aware follow-up question generation.
- Structured symptom information extraction.
- Summary generation based on patient responses.
- Avoidance of unsupported assumptions and invented information.
- Basic urgent-symptom escalation workflow.

## Application Workflow

1. Patient or doctor opens the application.
2. User selects their role.
3. Patients enter the symptom intake workflow.
4. AI asks standard questions and relevant follow-up questions.
5. Patient reviews and confirms the generated summary.
6. The submission becomes available on the doctor's dashboard.
7. Doctor reviews the summary before consultation.

## Product Metrics

The product is designed to measure improvements across two user groups.

**Patient-side metrics**
- Intake start rate.
- Question completion rate.
- Drop-off at each question.
- Summary generation rate.
- Summary submission rate.
- Patient feedback.

**Doctor-side metrics**
- Patients consulted per hour.
- Total patients consulted per day.
- Average consultation time for similar patient types.

These metrics can help evaluate whether the product improves workflow efficiency after introduction into a clinic.

## Technology Stack

Update this section to reflect the actual technologies and services used in the implementation.

- Frontend: [Add framework]
- Backend: [Add technology]
- Database: [Add database]
- AI Model/API: [Add model or provider]
- Voice Input: [Add speech-to-text technology]
- Authentication: [Add authentication solution]
- Deployment: [Add hosting platform]

## Current Scope

This project is an early-stage MVP focused on the core symptom intake and doctor review workflow.

The following are outside the current scope:

- Disease diagnosis.
- Medication and treatment recommendations.
- Prescription generation.
- Historical patient records.
- Appointment scheduling.
- Billing and hospital management.
- Multi-language support.
- Advanced clinical analytics.

## Safety and Disclaimer

This application is an experimental prototype and is not a clinically validated medical device.

It does not diagnose medical conditions or recommend treatments. AI-generated summaries are intended to organise information provided by patients for review by qualified healthcare professionals.

Potential emergency symptoms should trigger appropriate urgent-care guidance. The prototype must undergo clinical, privacy and security review before real-world patient deployment.

## Future Improvements

Potential areas for future development include:

- Doctor feedback and clinical review workflows.
- Additional language support.
- Improved speech recognition.
- Formal AI evaluation and accuracy testing.
- Advanced clinic analytics.
- Integration with existing clinic systems.

## Project Status

MVP / Prototype

Built as an AI Product Management portfolio project to explore how AI can improve patient intake and doctor consultation preparation.

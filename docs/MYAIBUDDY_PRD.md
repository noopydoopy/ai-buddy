# 📄 Product Requirements Document: My Daily AI Buddy

## Concept
"Building an AI-First Identity through a Personal Life Assistant"

## Goal
Develop the My Daily AI Buddy application using a local RAG architecture as a personalized assistant, measured by a functional MVP that allows me to log daily activities and retrieve them through natural language queries, within 14 days, to help streamline my life management and improve memory recall.

## 1. Core Identity & Persona
- **The Identity:** "ฉันคือนักพัฒนาอาวุโสที่ใช้ AI จัดการชีวิตอย่างเป็นระบบ"
- **The Buddy's Personality:** ปรับจูนให้เป็น "เลขาส่วนตัวที่รู้จักตัวตนของคุณ" (เช่น เป็นรุ่นพี่ที่คอยสะท้อนความคิด หรือเลขาสุขุมที่ช่วยจัดระเบียบ)

## 2. Technical Requirements (14-Day Sprint)
- **Engine:** Ollama (Llama 3.x / Mistral)
- **Memory:** ChromaDB (Vector Store for Daily Logs)
- **Logic:** Node.js + TypeScript + LangChain.js
- **Data Input:** Markdown Logs / Simple Chat Input
- **Intelligence:** RAG (Retrieval-Augmented Generation)

## 3. Implementation Phases
### Phase 1: The Persona & Environment
- **Setup:** ติดตั้ง Ollama และเตรียม Environment สำหรับ TypeScript
- **Identity Profile:** สร้าง JSON Configuration ที่เก็บข้อมูลส่วนตัว (Core Values, Habits, Communication Style) เพื่อใช้เป็น System Prompt
- **Connection:** เขียน Module เชื่อมต่อ Node.js เข้ากับ Ollama API
### Phase 2: Long-term Memory
- **Vector Setup:** ตั้งค่า ChromaDB เพื่อเก็บ Daily Logs
- **Ingestion Pipeline:** พัฒนาฟังก์ชันรับข้อความรายวัน (Input) -> ทำ Embedding -> บันทึกลง ChromaDB พร้อม Timestamp
- **Context Retrieval:** ทดสอบการดึงข้อมูลตามหัวข้อ (เช่น "อาทิตย์นี้ฉันพูดถึงเรื่องสุขภาพกี่ครั้ง?")
### Phase 3: The Conversation Logic
- **RAG Implementation:** พัฒนา Logic ที่เมื่อ User ถาม -> ค้นหาประวัติที่เกี่ยวข้องใน ChromaDB -> ผสมกับ Persona Profile -> ส่งให้ LLM ตอบ
- **Planning System:** เพิ่มความสามารถในการวิเคราะห์ "สิ่งที่ต้องทำ" (To-do) จาก Log ของวันก่อนหน้า
### Phase 4: UI/UX & Refinement
- **The Client:** พัฒนา Web Interface (React/Tailwind) หรือ CLI ที่ใช้งานง่าย
- **Summary Feature:** สร้างคำสั่งพิเศษ *Summary of my day* เพื่อให้ AI สรุปผลลัพธ์ประจำวันโดยอิงจากเป้าหมายระยะยาว (*Atomic Habits tracking*)

## 4. Key Success Metrics (Measurable)
- **Privacy:** ข้อมูลทั้งหมดรันบนเครื่อง 100% (*No data leaks*)
- **Context Awareness:** AI สามารถตอบได้ว่า "เมื่อวานคุณบอกว่ารู้สึกเหนื่อยจากการประชุม .NET" (*พิสูจน์ว่า RAG ทำงาน*)
- **Efficiency:** ใช้เวลาบันทึกและโต้ตอบไม่เกิน 5 นาทีต่อวัน เพื่อให้เกิดเป็น Habit ที่ยั่งยืน.
document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chatInput");
  const sendMessageBtn = document.getElementById("sendMessage");
  const chatMessages = document.getElementById("chatMessages");
  const topBarWrapper = document.getElementById("topBarWrapper");
  const toggleTopBarBtn = document.getElementById("toggleTopBar");
  const newChatButton = document.getElementById("newChatButton");
  const chatListContainer = document.getElementById("chatListContainer");

  // --- Chat Session Management ---
  let chatSessions = new Map(); // Stores chat histories { chatId: [{sender, content, isImage}] }
  let currentChatId = null;
  let chatCounter = 0; // To generate unique IDs for new chats

  const AI_WELCOME_MESSAGE =
    'Hello! Type your message or use "/image [prompt]" to generate an image.';

  // Function to create a new chat session
  function createNewChatSession() {
    chatCounter++;
    const newId = `chat-${chatCounter}`;
    // Store an initial AI message for the new chat
    chatSessions.set(newId, [
      { sender: "ai", content: AI_WELCOME_MESSAGE, isImage: false },
    ]);
    return newId;
  }

  // Function to switch to a different chat session
  function switchChat(chatId) {
    if (currentChatId === chatId) return; // Already on this chat

    currentChatId = chatId;
    renderChatMessages(); // Display messages for the new chat
    updateChatListUI(); // Update active state in top bar
    // Optionally collapse top bar after switching
    if (topBarWrapper.classList.contains("expanded")) {
      topBarWrapper.classList.remove("expanded");
      topBarWrapper.classList.add("collapsed");
    }
  }

  // Function to render messages for the current chat session
  function renderChatMessages() {
    chatMessages.innerHTML = ""; // Clear current messages from UI
    const messages = chatSessions.get(currentChatId) || [];
    messages.forEach((msg) =>
      appendMessageToUI(msg.sender, msg.content, msg.isImage),
    );
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
  }

  // Function to append a message to the UI (does not modify session history)
  function appendMessageToUI(sender, content, isImage = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    messageDiv.classList.add(sender === "user" ? "user-message" : "ai-message");

    if (isImage) {
      const img = document.createElement("img");
      img.src = content;
      img.alt = "Generated Image";
      messageDiv.appendChild(img);
    } else {
      const p = document.createElement("p");
      p.textContent = content;
      messageDiv.appendChild(p);
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
  }

  // Function to add a message to the current chat session's history AND update UI
  function addMessageToCurrentChat(sender, content, isImage) {
    const messages = chatSessions.get(currentChatId);
    if (messages) {
      messages.push({ sender, content, isImage });
    }
    appendMessageToUI(sender, content, isImage); // Also update UI
  }

  // Function to update the list of chat buttons in the top bar
  function updateChatListUI() {
    chatListContainer.innerHTML = ""; // Clear existing buttons
    chatSessions.forEach((messages, id) => {
      const chatButton = document.createElement("button");
      chatButton.classList.add("chat-item-button");
      chatButton.textContent =
        messages.length > 1
          ? messages[1].content.substring(0, 30) + "..."
          : `New Chat ${id.split("-")[1]}`; // Show first user message or default
      if (id === currentChatId) {
        chatButton.classList.add("active");
      }
      chatButton.addEventListener("click", () => switchChat(id));
      chatListContainer.appendChild(chatButton);
    });
  }

  // --- Loading Indicator ---
  function showLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "ai-message", "loading-indicator");
    loadingDiv.id = "loadingIndicator";
    loadingDiv.textContent = "AI is thinking...";
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hideLoading() {
    const loadingDiv = document.getElementById("loadingIndicator");
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  // --- Core Message Sending Logic ---
  async function sendMessage() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    addMessageToCurrentChat("user", prompt); // Add to history and UI
    chatInput.value = "";

    showLoading();

    try {
      if (prompt.startsWith("/image ")) {
        const imagePrompt = prompt.substring(7).trim();
        if (!imagePrompt) {
          hideLoading();
          addMessageToCurrentChat(
            "ai",
            'Please provide a prompt for the image after "/image".',
            false,
          );
          return;
        }
        const textResponse = await generateTextForImage(imagePrompt);
        addMessageToCurrentChat("ai", textResponse, false);

        await generateImage(imagePrompt);
      } else {
        await generateText(prompt);
      }
    } catch (error) {
      hideLoading();
      console.error("Error in sendMessage:", error);
      addMessageToCurrentChat(
        "ai",
        `An error occurred: ${error.message}`,
        false,
      );
    }
  }

  // --- API Interactions ---
  async function generateText(prompt) {
    try {
      const response = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
      );
      hideLoading();

      if (response.ok) {
        const text = await response.text();
        addMessageToCurrentChat("ai", text, false);
      } else {
        const errorText = await response.text();
        addMessageToCurrentChat(
          "ai",
          `Error generating text: ${response.status} ${response.statusText} - ${errorText}`,
          false,
        );
        console.error(
          "Text generation error:",
          response.status,
          response.statusText,
          errorText,
        );
      }
    } catch (error) {
      hideLoading();
      addMessageToCurrentChat(
        "ai",
        `Network error during text generation: ${error.message}`,
        false,
      );
      console.error("Fetch error for text generation:", error);
    }
  }

  async function generateTextForImage(imagePrompt) {
    try {
      const textPrompt = `You are an AI generating an image based on the prompt "${imagePrompt}". Briefly describe what kind of image you are creating in a conversational tone.`;
      const response = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(textPrompt)}`,
      );

      if (response.ok) {
        return await response.text();
      } else {
        console.error(
          "Error generating descriptive text for image:",
          response.status,
          response.statusText,
        );
        return `Okay, I'm generating an image for "${imagePrompt}".`;
      }
    } catch (error) {
      console.error(
        "Network error during text generation for image prompt:",
        error,
      );
      return `Okay, I'm generating an image for "${imagePrompt}".`;
    }
  }

  async function generateImage(prompt) {
    try {
      const response = await fetch(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
      );
      hideLoading();

      if (response.ok) {
        const imageUrl = response.url;
        addMessageToCurrentChat("ai", imageUrl, true);
      } else {
        try {
          const errorText = await response.text();
          addMessageToCurrentChat(
            "ai",
            `Error generating image: ${response.status} ${response.statusText} - ${errorText}`,
            false,
          );
        } catch (e) {
          addMessageToCurrentChat(
            "ai",
            `Error generating image: ${response.status} ${response.statusText}`,
            false,
          );
        }
        console.error(
          "Image generation error:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      hideLoading();
      addMessageToCurrentChat(
        "ai",
        `Network error during image generation: ${error.message}`,
        false,
      );
      console.error("Fetch error for image generation:", error);
    }
  }

  // --- Event Listeners and Initialization ---

  // Toggle Top Bar
  toggleTopBarBtn.addEventListener("click", () => {
    topBarWrapper.classList.toggle("collapsed");
    topBarWrapper.classList.toggle("expanded");
  });

  // New Chat Button
  newChatButton.addEventListener("click", () => {
    const newChatId = createNewChatSession();
    switchChat(newChatId);
  });

  // Send Message
  sendMessageBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });

  // Initialize: Create the first chat session and render it
  const initialChatId = createNewChatSession();
  switchChat(initialChatId);
});

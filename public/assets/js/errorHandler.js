// Create a new file for frontend error handling
// Check if ErrorHandler already exists to prevent duplicate declarations
if (typeof ErrorHandler === 'undefined') {
  class ErrorHandler {
  constructor(errorContainerId = 'errorContainer') {
    this.errorContainer = document.getElementById(errorContainerId);
    this.setup();
  }

  setup() {
    // Create error container if it doesn't exist
    if (!this.errorContainer) {
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = 'errorContainer';
      this.errorContainer.className = 'hidden fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50';
      this.errorContainer.innerHTML = `
        <div class="flex items-center">
          <div class="py-1"><svg class="h-6 w-6 text-red-500 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <span id="errorMessage"></span>
          <button type="button" class="ml-auto" id="closeError">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      `;
      document.body.appendChild(this.errorContainer);

      // Add close button event listener
      document.getElementById('closeError').addEventListener('click', () => {
        this.hideError();
      });
    }
  }

  showError(message, timeout = 5000) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    this.errorContainer.classList.remove('hidden');

    // Automatically hide after timeout
    if (timeout > 0) {
      setTimeout(() => {
        this.hideError();
      }, timeout);
    }
  }

  hideError() {
    this.errorContainer.classList.add('hidden');
  }

  // Handle fetch API errors
  async handleFetchError(response) {
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const data = await response.json();
        errorMessage = data.error?.message || data.message || errorMessage;
      } catch (e) {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
      }
      this.showError(errorMessage);
      throw new Error(errorMessage);
    }
    return response;
  }
  }

  // Export for use in other files
  window.ErrorHandler = new ErrorHandler();
}
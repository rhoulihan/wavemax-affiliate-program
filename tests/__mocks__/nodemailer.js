// Mock for nodemailer
const mockSendMail = jest.fn().mockResolvedValue({
  messageId: 'test-message-id',
  response: '250 Message accepted'
});

const mockTransporter = {
  sendMail: mockSendMail
};

const createTransport = jest.fn().mockReturnValue(mockTransporter);

module.exports = {
  createTransport,
  __mockTransporter: mockTransporter,
  __mockSendMail: mockSendMail
};
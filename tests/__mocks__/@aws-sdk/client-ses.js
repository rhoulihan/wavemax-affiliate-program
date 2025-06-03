// Mock for AWS SES
const mockSESClient = jest.fn().mockImplementation(function(config) {
  this.config = config;
  this.send = jest.fn().mockResolvedValue({
    MessageId: 'ses-message-id'
  });
});

const SendEmailCommand = jest.fn().mockImplementation(function(params) {
  this.params = params;
});

module.exports = {
  SESClient: mockSESClient,
  SendEmailCommand
};
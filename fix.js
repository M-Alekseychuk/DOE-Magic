const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
code = code.replace(
`              </ResponsiveContainer>
              </div>
            </div>
            ) : (`,
`              </ResponsiveContainer>
            ) : (`
);
code = code.replace(
`                  </LineChart>
                </ResponsiveContainer>
                </div>
                <div className="h-6 flex items-center justify-center shrink-0">
                  <span className="text-[11px] text-slate-600 font-medium">{interactionData.f1.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
</div>`,
`                  </LineChart>
                </ResponsiveContainer>
                </div>
                <div className="h-6 flex items-center justify-center shrink-0">
                  <span className="text-[11px] text-slate-600 font-medium">{interactionData.f1.name}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null; // Fallback
</div>`
); // Let's just restore the file completely from a known good state.
